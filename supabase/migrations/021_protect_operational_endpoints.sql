BEGIN;

SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.ai_action_proposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    skill_name varchar(64) NOT NULL,
    proposal_type varchar(64) NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
    confidence_score numeric(4,3) NOT NULL,
    reasoning text NOT NULL,
    proposed_payload jsonb NOT NULL DEFAULT '{}',
    reviewed_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_proposals_status
    ON public.ai_action_proposals(restaurant_id, status, created_at DESC);

ALTER TABLE public.ai_action_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_action_proposals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_action_proposals TO service_role;

ALTER TABLE public.restaurant_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.restaurant_events TO service_role;

DO $$
DECLARE
    event_sequence regclass := pg_get_serial_sequence('public.restaurant_events', 'id')::regclass;
BEGIN
    IF event_sequence IS NOT NULL THEN
        EXECUTE format('GRANT USAGE ON SEQUENCE %s TO service_role', event_sequence);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_ai_proposal(
    p_restaurant_id uuid, p_staff_id uuid, p_proposal_id uuid, p_action text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    proposal public.ai_action_proposals%ROWTYPE;
    category jsonb;
    v_category_id uuid;
    next_status text;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.staff WHERE id = p_staff_id AND restaurant_id = p_restaurant_id
          AND is_active AND role IN ('owner', 'manager')
    ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'error', 'Review access denied');
    END IF;

    SELECT * INTO proposal FROM public.ai_action_proposals
    WHERE id = p_proposal_id AND restaurant_id = p_restaurant_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'not_found', 'error', 'Proposal not found');
    END IF;
    IF proposal.status IS DISTINCT FROM 'pending' THEN
        RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Proposal has already been reviewed');
    END IF;

    IF p_action = 'reject' THEN
        next_status := 'rejected';
    ELSIF p_action = 'approve' THEN
        next_status := 'executed';
        CASE proposal.proposal_type
            WHEN 'auto_86_item' THEN
                UPDATE public.menu_items SET is_available = false
                WHERE restaurant_id = p_restaurant_id
                  AND id::text IN (
                    SELECT value FROM jsonb_array_elements_text(proposal.proposed_payload->'items_to_auto_86')
                  );
            WHEN 'bulk_menu_import' THEN
                FOR category IN SELECT value FROM jsonb_array_elements(proposal.proposed_payload->'categories')
                LOOP
                    INSERT INTO public.categories (restaurant_id, name, description, is_active)
                    VALUES (p_restaurant_id, category->>'name', category->>'description', true)
                    RETURNING id INTO v_category_id;

                    INSERT INTO public.menu_items (restaurant_id, category_id, name, description,
                                                   price, cost_price, preparation_time, is_available, customizations)
                    SELECT p_restaurant_id, v_category_id, item.name, item.description, item.price,
                           COALESCE(item.cost_price, 0), COALESCE(item.preparation_time, 15),
                           true, COALESCE(item.customizations, '[]')
                    FROM jsonb_to_recordset(category->'items') AS item(
                        name text, description text, price numeric, cost_price numeric,
                        preparation_time integer, customizations jsonb
                    );
                END LOOP;
            WHEN 'pacing_throttle', 'flag_cashier_discrepancy' THEN
                next_status := 'approved';
            ELSE
                RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Unsupported proposal type');
        END CASE;
    ELSE
        RETURN jsonb_build_object('success', false, 'code', 'invalid', 'error', 'Invalid review action');
    END IF;

    UPDATE public.ai_action_proposals
    SET status = next_status, reviewed_by = p_staff_id, reviewed_at = now()
    WHERE id = p_proposal_id AND restaurant_id = p_restaurant_id
    RETURNING * INTO proposal;

    INSERT INTO public.restaurant_events (restaurant_id, aggregate_type, aggregate_id, event_type, payload)
    VALUES (p_restaurant_id, 'AI_PROPOSAL', p_proposal_id, 'AI_PROPOSAL_' || upper(next_status),
            jsonb_build_object('proposal_id', p_proposal_id, 'proposal_type', proposal.proposal_type,
                               'skill_name', proposal.skill_name, 'reviewed_by', p_staff_id,
                               'status', next_status));

    RETURN jsonb_build_object('success', true, 'proposal', to_jsonb(proposal));
END;
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_restaurant_template(
    p_restaurant_id uuid, p_staff_id uuid, p_archetype text, p_currency text,
    p_tax_rate numeric, p_template jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    prior jsonb;
    category jsonb;
    v_category_id uuid;
    tables_added integer;
    categories_added integer := 0;
    items_added integer := 0;
    registers_added integer;
    rows_added integer;
    stats jsonb;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.staff s JOIN public.restaurants r ON r.id = s.restaurant_id
        WHERE s.id = p_staff_id AND s.restaurant_id = p_restaurant_id
          AND s.is_active AND s.role = 'owner' AND s.user_id = r.owner_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'error', 'Restaurant owner access required');
    END IF;

    PERFORM id FROM public.restaurants WHERE id = p_restaurant_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'not_found', 'error', 'Restaurant not found');
    END IF;

    SELECT payload INTO prior FROM public.restaurant_events
    WHERE restaurant_id = p_restaurant_id AND aggregate_type = 'RESTAURANT'
      AND aggregate_id = p_restaurant_id AND event_type = 'RESTAURANT_BOOTSTRAPPED'
    ORDER BY id DESC LIMIT 1;

    IF FOUND THEN
        IF prior->>'archetype' IS DISTINCT FROM p_archetype
           OR prior->>'currency' IS DISTINCT FROM p_currency
           OR (prior->>'tax_rate')::numeric IS DISTINCT FROM p_tax_rate THEN
            RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Restaurant setup already completed');
        END IF;
        RETURN jsonb_build_object('success', true, 'stats', prior - 'staff_id');
    END IF;

    UPDATE public.restaurants SET currency = p_currency, tax_rate = p_tax_rate WHERE id = p_restaurant_id;

    INSERT INTO public.tables (restaurant_id, table_number, capacity, status, version, is_qr_active)
    SELECT p_restaurant_id, t.table_number, t.capacity, 'available', 1, true
    FROM jsonb_to_recordset(p_template->'tables') AS t(table_number text, capacity integer)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.tables existing WHERE existing.restaurant_id = p_restaurant_id
          AND existing.table_number = t.table_number
    );
    GET DIAGNOSTICS tables_added = ROW_COUNT;

    FOR category IN SELECT value FROM jsonb_array_elements(p_template->'categories')
    LOOP
        SELECT id INTO v_category_id FROM public.categories
        WHERE restaurant_id = p_restaurant_id AND name = category->>'name'
        ORDER BY id LIMIT 1;

        IF NOT FOUND THEN
            INSERT INTO public.categories (restaurant_id, name, description, display_order, is_active)
            VALUES (p_restaurant_id, category->>'name', category->>'description',
                    (category->>'display_order')::integer, true)
            RETURNING id INTO v_category_id;
            categories_added := categories_added + 1;
        END IF;

        INSERT INTO public.menu_items (restaurant_id, category_id, name, description, price, cost_price,
                                       preparation_time, is_available, customizations)
        SELECT p_restaurant_id, v_category_id, item.name, item.description, item.price, item.cost_price,
               item.preparation_time, true, COALESCE(item.customizations, '[]')
        FROM jsonb_to_recordset(category->'items') AS item(
            name text, description text, price numeric, cost_price numeric,
            preparation_time integer, customizations jsonb
        )
        WHERE NOT EXISTS (
            SELECT 1 FROM public.menu_items existing WHERE existing.restaurant_id = p_restaurant_id
              AND existing.category_id = v_category_id AND existing.name = item.name
        );
        GET DIAGNOSTICS rows_added = ROW_COUNT;
        items_added := items_added + rows_added;
    END LOOP;

    INSERT INTO public.cash_registers (restaurant_id, name, is_active)
    SELECT p_restaurant_id, entry.value, true FROM jsonb_array_elements_text(p_template->'registers') entry
    WHERE NOT EXISTS (
        SELECT 1 FROM public.cash_registers existing
        WHERE existing.restaurant_id = p_restaurant_id AND existing.name = entry.value
    );
    GET DIAGNOSTICS registers_added = ROW_COUNT;

    stats := jsonb_build_object('archetype', p_archetype, 'currency', p_currency, 'tax_rate', p_tax_rate,
                                'tables_created', tables_added, 'categories_created', categories_added,
                                'items_created', items_added, 'registers_created', registers_added);
    INSERT INTO public.restaurant_events (restaurant_id, aggregate_type, aggregate_id, event_type, payload)
    VALUES (p_restaurant_id, 'RESTAURANT', p_restaurant_id, 'RESTAURANT_BOOTSTRAPPED',
            stats || jsonb_build_object('staff_id', p_staff_id));

    RETURN jsonb_build_object('success', true, 'stats', stats);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_ai_proposal(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_ai_proposal(uuid, uuid, uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.bootstrap_restaurant_template(uuid, uuid, text, text, numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_restaurant_template(uuid, uuid, text, text, numeric, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

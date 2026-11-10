-- NexusPOS follow-up for a database that already applied the repair through 018.
-- Includes 019 (secure dispatch) and 020 (cash on delivery).
BEGIN;

SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
    IF to_regprocedure('public.transition_delivery_assignment(uuid,uuid,text,uuid,boolean)') IS NULL
       OR to_regprocedure('public.settle_restaurant_order_payment(jsonb)') IS NULL
       OR to_regclass('public.payment_command_receipts') IS NULL THEN
        RAISE EXCEPTION 'Apply the NexusPOS repair and upgrade through 018 before this bundle';
    END IF;
END;
$$;

-- 019_secure_dispatch.sql
SET LOCAL lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.assign_delivery_rider(
    p_restaurant_id uuid, p_assignment_id uuid, p_rider_id uuid, p_staff_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_assignment public.delivery_assignments%ROWTYPE;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.staff
        WHERE id = p_staff_id AND restaurant_id = p_restaurant_id
          AND is_active AND role IN ('owner', 'manager')
    ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'error', 'Dispatch access denied');
    END IF;

    SELECT * INTO v_assignment FROM public.delivery_assignments
    WHERE id = p_assignment_id AND restaurant_id = p_restaurant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'not_found', 'error', 'Delivery assignment not found');
    END IF;

    IF v_assignment.status = 'assigned' AND v_assignment.rider_id = p_rider_id THEN
        RETURN jsonb_build_object('success', true, 'status', 'assigned');
    END IF;

    IF v_assignment.status IS DISTINCT FROM 'pending_dispatch' THEN
        RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Delivery has already been assigned or closed');
    END IF;

    PERFORM id FROM public.orders
    WHERE id = v_assignment.order_id AND restaurant_id = p_restaurant_id
      AND order_type = 'delivery' AND status IS DISTINCT FROM 'cancelled'
    FOR SHARE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Order is not eligible for dispatch');
    END IF;

    PERFORM id FROM public.staff
    WHERE id = p_rider_id AND restaurant_id = p_restaurant_id
      AND is_active AND role IN ('rider', 'delivery')
    FOR SHARE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'not_found', 'error', 'Active rider not found');
    END IF;

    UPDATE public.delivery_assignments
    SET rider_id = p_rider_id, status = 'assigned', assigned_at = now(), updated_at = now()
    WHERE id = p_assignment_id;

    INSERT INTO public.restaurant_events (restaurant_id, aggregate_type, aggregate_id, event_type, payload)
    VALUES (p_restaurant_id, 'DELIVERY', p_assignment_id, 'DELIVERY_RIDER_ASSIGNED',
            jsonb_build_object('delivery_id', p_assignment_id, 'order_id', v_assignment.order_id,
                               'rider_id', p_rider_id, 'staff_id', p_staff_id));

    RETURN jsonb_build_object('success', true, 'status', 'assigned');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_delivery_rider(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_delivery_rider(uuid, uuid, uuid, uuid) TO service_role;

ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_assignments FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.delivery_assignments FROM authenticated;
DROP POLICY IF EXISTS "Staff and riders update deliveries" ON public.delivery_assignments;

-- A restrictive policy also applies when an older permissive policy is installed.
DROP POLICY IF EXISTS "Restrict delivery reads to dispatch or assigned rider" ON public.delivery_assignments;
CREATE POLICY "Restrict delivery reads to dispatch or assigned rider"
ON public.delivery_assignments AS RESTRICTIVE FOR SELECT TO authenticated
USING (
    public.get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier')
    OR (
        public.get_current_staff_role(restaurant_id) IN ('rider', 'delivery')
        AND EXISTS (
            SELECT 1 FROM public.staff
            WHERE staff.id = delivery_assignments.rider_id
              AND staff.restaurant_id = delivery_assignments.restaurant_id
              AND staff.user_id = auth.uid() AND staff.is_active
        )
    )
);

-- Supply the matching permissive policy for environments without migration 015 policies.
DROP POLICY IF EXISTS "Dispatch and assigned rider can read deliveries" ON public.delivery_assignments;
CREATE POLICY "Dispatch and assigned rider can read deliveries"
ON public.delivery_assignments FOR SELECT TO authenticated
USING (public.get_current_staff_role(restaurant_id) IN ('owner', 'manager', 'cashier', 'rider', 'delivery'));

NOTIFY pgrst, 'reload schema';

-- 020_cash_on_delivery.sql
SET LOCAL lock_timeout = '10s';

ALTER TABLE public.delivery_assignments
    ADD COLUMN IF NOT EXISTS cod_collected_at timestamptz,
    ADD COLUMN IF NOT EXISTS cod_settled_by uuid REFERENCES public.staff(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS delivery_one_cod_collection_per_order
    ON public.delivery_assignments(order_id) WHERE cod_collected_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.complete_delivery_with_cash(
    p_restaurant_id uuid, p_assignment_id uuid, p_staff_id uuid, p_can_manage boolean,
    p_cash_collected numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_assignment public.delivery_assignments%ROWTYPE;
    v_order public.orders%ROWTYPE;
    v_due numeric;
    v_result jsonb;
BEGIN
    SELECT * INTO v_assignment FROM public.delivery_assignments
    WHERE id = p_assignment_id AND restaurant_id = p_restaurant_id FOR UPDATE;

    IF NOT FOUND OR (NOT COALESCE(p_can_manage, false)
                    AND v_assignment.rider_id IS DISTINCT FROM p_staff_id) THEN
        RETURN jsonb_build_object('success', false, 'code', 'not_found', 'error', 'Delivery assignment not found');
    END IF;

    SELECT * INTO v_order FROM public.orders
    WHERE id = v_assignment.order_id AND restaurant_id = p_restaurant_id FOR UPDATE;
    IF NOT FOUND OR v_order.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Order is unavailable for delivery');
    END IF;

    IF v_assignment.status = 'delivered' THEN
        IF p_cash_collected IS NOT NULL AND p_cash_collected IS DISTINCT FROM v_assignment.cod_amount_collected THEN
            RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'A different cash amount was already recorded');
        END IF;
        RETURN jsonb_build_object('success', true, 'status', 'delivered',
                                  'cash_collected', COALESCE(v_assignment.cod_amount_collected, 0));
    END IF;

    v_due := CASE WHEN v_order.payment_method = 'cash_on_delivery'
        THEN GREATEST(0, v_order.total - COALESCE(v_order.amount_paid, 0)) ELSE 0 END;

    IF v_due > 0 THEN
        IF EXISTS (
            SELECT 1 FROM public.delivery_assignments
            WHERE order_id = v_order.id AND id <> p_assignment_id AND cod_collected_at IS NOT NULL
        ) THEN
            RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Cash was already collected for this order');
        END IF;
        IF v_assignment.rider_id IS DISTINCT FROM p_staff_id OR NOT EXISTS (
            SELECT 1 FROM public.staff WHERE id = p_staff_id AND restaurant_id = p_restaurant_id
              AND is_active AND role IN ('rider', 'delivery')
        ) THEN
            RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'error', 'The assigned rider must confirm cash collection');
        END IF;
        IF p_cash_collected IS DISTINCT FROM v_due THEN
            RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Confirm the exact cash balance collected');
        END IF;
    ELSIF p_cash_collected IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'This delivery has no cash to collect');
    END IF;

    v_result := public.transition_delivery_assignment(
        p_restaurant_id, p_assignment_id, 'delivered', p_staff_id, p_can_manage
    );
    IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
        RETURN v_result;
    END IF;

    IF v_due > 0 THEN
        UPDATE public.delivery_assignments
        SET cod_amount_collected = v_due, cod_collected_at = now(),
            cod_settled = false, cod_settled_at = NULL, cod_settled_by = NULL
        WHERE id = p_assignment_id;

        INSERT INTO public.restaurant_events (restaurant_id, aggregate_type, aggregate_id, event_type, payload)
        VALUES (p_restaurant_id, 'DELIVERY', p_assignment_id, 'COD_CASH_COLLECTED',
                jsonb_build_object('order_id', v_order.id, 'rider_id', p_staff_id, 'amount', v_due));
    END IF;

    RETURN v_result || jsonb_build_object('cash_collected', v_due);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_delivery_cash(
    p_restaurant_id uuid, p_assignment_id uuid, p_staff_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_assignment public.delivery_assignments%ROWTYPE;
    v_order public.orders%ROWTYPE;
    v_result jsonb;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.staff WHERE id = p_staff_id AND restaurant_id = p_restaurant_id
          AND is_active AND role IN ('owner', 'manager', 'cashier')
    ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'error', 'Cash reconciliation access denied');
    END IF;

    SELECT * INTO v_assignment FROM public.delivery_assignments
    WHERE id = p_assignment_id AND restaurant_id = p_restaurant_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'not_found', 'error', 'Delivery assignment not found');
    END IF;

    IF v_assignment.status IS DISTINCT FROM 'delivered'
       OR v_assignment.cod_collected_at IS NULL
       OR COALESCE(v_assignment.cod_amount_collected, 0) <= 0 THEN
        RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'No recorded cash collection to reconcile');
    END IF;

    IF v_assignment.cod_settled THEN
        RETURN jsonb_build_object('success', true, 'cash_reconciled', v_assignment.cod_amount_collected);
    END IF;

    SELECT * INTO v_order FROM public.orders
    WHERE id = v_assignment.order_id AND restaurant_id = p_restaurant_id FOR UPDATE;
    IF NOT FOUND OR v_order.payment_method IS DISTINCT FROM 'cash_on_delivery'
       OR v_order.status IS DISTINCT FROM 'served'
       OR v_assignment.cod_amount_collected IS DISTINCT FROM v_order.total - COALESCE(v_order.amount_paid, 0) THEN
        RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Cash and outstanding order balance do not match');
    END IF;

    BEGIN
        UPDATE public.delivery_assignments
        SET cod_settled = true, cod_settled_at = now(), cod_settled_by = p_staff_id, updated_at = now()
        WHERE id = p_assignment_id;

        v_result := public.settle_restaurant_order_payment(jsonb_build_object(
            'order_id', v_order.id, 'restaurant_id', p_restaurant_id, 'staff_id', p_staff_id,
            'payment_method', 'cash', 'amount', v_assignment.cod_amount_collected,
            'cash_received', v_assignment.cod_amount_collected, 'request_key', p_assignment_id
        ));
        IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
            RAISE EXCEPTION USING ERRCODE = 'PZ001', MESSAGE = 'Cash reconciliation settlement rejected';
        END IF;

        INSERT INTO public.restaurant_events (restaurant_id, aggregate_type, aggregate_id, event_type, payload)
        VALUES (p_restaurant_id, 'DELIVERY', p_assignment_id, 'COD_CASH_RECONCILED',
                jsonb_build_object('order_id', v_order.id, 'staff_id', p_staff_id,
                                   'amount', v_assignment.cod_amount_collected));
    EXCEPTION WHEN SQLSTATE 'PZ001' THEN
        RETURN v_result;
    END;

    RETURN jsonb_build_object('success', true, 'cash_reconciled', v_assignment.cod_amount_collected);
END;
$$;

-- A COD sale can only be recorded after its exact rider handoff is reconciled.
CREATE OR REPLACE FUNCTION public.protect_cod_settlement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.payment_method = 'cash_on_delivery'
       AND (NEW.payment_method IS DISTINCT FROM OLD.payment_method
            OR (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid')
            OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
            OR NEW.payment_status IS DISTINCT FROM OLD.payment_status)
       AND NOT EXISTS (
           SELECT 1 FROM public.delivery_assignments
           WHERE order_id = OLD.id AND restaurant_id = OLD.restaurant_id
             AND status = 'delivered' AND cod_settled IS TRUE AND cod_settled_by IS NOT NULL
             AND cod_amount_collected = OLD.total - COALESCE(OLD.amount_paid, 0)
       ) THEN
        RAISE EXCEPTION 'Reconcile the rider cash handoff before settling this order' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_cod_settlement ON public.orders;
CREATE TRIGGER protect_cod_settlement BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.protect_cod_settlement();

REVOKE EXECUTE ON FUNCTION public.complete_delivery_with_cash(uuid, uuid, uuid, boolean, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_delivery_with_cash(uuid, uuid, uuid, boolean, numeric) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reconcile_delivery_cash(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_delivery_cash(uuid, uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

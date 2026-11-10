BEGIN;

-- These commands are called by OrderService with the server's service role.
DO $$
DECLARE
    command record;
BEGIN
    FOR command IN
        SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prokind = 'f'
          AND p.proname IN (
              'generate_daily_order_number', 'seat_table_atomic', 'create_order_atomic',
              'request_or_execute_item_void', 'settle_order_payment_atomic',
              'transfer_table_atomic', 'merge_tables_atomic', 'advance_kds_item_atomic',
              'update_delivery_status_atomic', 'update_rider_location', 'record_delivery_location'
          )
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
            command.proname, command.arguments
        );
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
            command.proname, command.arguments
        );
        EXECUTE format(
            'ALTER FUNCTION public.%I(%s) SET search_path = public, extensions, pg_temp',
            command.proname, command.arguments
        );
    END LOOP;
END;
$$;

-- Hold the tenant-scoped order lock through the existing settlement transaction.
CREATE OR REPLACE FUNCTION public.settle_restaurant_order_payment(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM id FROM public.orders
    WHERE id = (p_payload->>'order_id')::uuid
      AND restaurant_id = (p_payload->>'restaurant_id')::uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    RETURN public.settle_order_payment_atomic(p_payload);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_restaurant_order_payment(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_restaurant_order_payment(jsonb) TO service_role;

DO $$
BEGIN
    IF to_regclass('public.order_item_modifiers') IS NOT NULL THEN
        ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Staff member access modifiers" ON public.order_item_modifiers;
        DROP POLICY IF EXISTS "Restaurant staff can read order modifiers" ON public.order_item_modifiers;
        REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_item_modifiers FROM PUBLIC, anon, authenticated;
        CREATE POLICY "Restaurant staff can read order modifiers" ON public.order_item_modifiers
            FOR SELECT TO authenticated
            USING (EXISTS (
                SELECT 1
                FROM public.order_items item
                JOIN public.orders ord ON ord.id = item.order_id
                WHERE item.id = order_item_modifiers.order_item_id
                  AND public.is_restaurant_member(ord.restaurant_id)
            ));
    END IF;

    IF to_regclass('public.rider_locations') IS NOT NULL THEN
        ALTER TABLE public.rider_locations ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Service role full access" ON public.rider_locations;
        DROP POLICY IF EXISTS "Fleet managers can view rider locations" ON public.rider_locations;
        CREATE POLICY "Fleet managers can view rider locations" ON public.rider_locations
            FOR SELECT TO authenticated
            USING (public.get_current_staff_role(restaurant_id) IN ('owner', 'manager'));
    END IF;

    IF to_regclass('public.rider_location_history') IS NOT NULL THEN
        ALTER TABLE public.rider_location_history ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON public.rider_location_history FROM PUBLIC, anon, authenticated;
        DROP POLICY IF EXISTS "Service role full access" ON public.rider_location_history;
        CREATE INDEX IF NOT EXISTS rider_location_history_order_rider_time_idx
            ON public.rider_location_history(order_id, rider_id, recorded_at DESC);
    END IF;
END;
$$;

COMMIT;

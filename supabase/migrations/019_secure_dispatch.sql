BEGIN;

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

COMMIT;

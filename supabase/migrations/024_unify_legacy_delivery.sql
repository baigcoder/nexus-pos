BEGIN;

SET LOCAL lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.report_delivery_exception(
    p_restaurant_id uuid, p_assignment_id uuid, p_staff_id uuid, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_assignment public.delivery_assignments%ROWTYPE;
    v_role text;
    v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
    IF v_reason IS NULL OR length(v_reason) > 500 THEN
        RETURN jsonb_build_object('success', false, 'code', 'invalid', 'error', 'A delivery exception reason is required');
    END IF;

    SELECT role INTO v_role FROM public.staff
    WHERE id = p_staff_id AND restaurant_id = p_restaurant_id AND is_active;
    IF NOT FOUND OR v_role NOT IN ('owner', 'manager', 'rider', 'delivery') THEN
        RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'error', 'Delivery access denied');
    END IF;

    SELECT * INTO v_assignment FROM public.delivery_assignments
    WHERE id = p_assignment_id AND restaurant_id = p_restaurant_id FOR UPDATE;
    IF NOT FOUND OR (v_role IN ('rider', 'delivery') AND v_assignment.rider_id IS DISTINCT FROM p_staff_id) THEN
        RETURN jsonb_build_object('success', false, 'code', 'not_found', 'error', 'Delivery assignment not found');
    END IF;

    IF v_assignment.status = 'dispatch_exception' AND v_assignment.cancel_reason = v_reason THEN
        RETURN jsonb_build_object('success', true, 'status', 'dispatch_exception');
    END IF;
    IF v_assignment.status NOT IN ('assigned', 'ready_pickup', 'picked_up', 'en_route', 'arrived') THEN
        RETURN jsonb_build_object('success', false, 'code', 'conflict', 'error', 'Delivery is not active');
    END IF;

    UPDATE public.delivery_assignments
    SET status = 'dispatch_exception', cancel_reason = v_reason, updated_at = now()
    WHERE id = p_assignment_id;

    INSERT INTO public.restaurant_events (restaurant_id, aggregate_type, aggregate_id, event_type, payload)
    VALUES (p_restaurant_id, 'DELIVERY', p_assignment_id, 'DELIVERY_EXCEPTION_REPORTED',
            jsonb_build_object('order_id', v_assignment.order_id, 'staff_id', p_staff_id, 'reason', v_reason));

    RETURN jsonb_build_object('success', true, 'status', 'dispatch_exception');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_delivery_exception(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_delivery_exception(uuid, uuid, uuid, text) TO service_role;

DO $$
BEGIN
    IF to_regclass('public.delivery_tracking') IS NULL THEN RETURN; END IF;

    -- Keep legacy history, migrate only orders with no existing canonical assignment.
    LOCK TABLE public.delivery_tracking IN SHARE MODE;
    LOCK TABLE public.delivery_assignments IN SHARE ROW EXCLUSIVE MODE;

    INSERT INTO public.delivery_assignments (
        order_id, restaurant_id, rider_id, customer_name, customer_phone, delivery_address,
        delivery_lat, delivery_lng, status, actual_pickup_time, actual_delivery_time,
        estimated_minutes, actual_minutes, distance_km, customer_feedback, rating, created_at
    )
    SELECT DISTINCT ON (dt.order_id)
        dt.order_id, dt.restaurant_id, rider.id, COALESCE(o.customer_name, 'Customer'), o.customer_phone,
        COALESCE(dt.delivery_address, o.delivery_address, 'Address not recorded'),
        dt.customer_lat, dt.customer_lng,
        CASE
            WHEN o.status = 'cancelled' THEN 'cancelled'
            WHEN dt.status = 'delivered' THEN 'delivered'
            WHEN dt.status = 'failed' THEN 'dispatch_exception'
            WHEN dt.status IN ('picked_up', 'in_transit') AND rider.id IS NULL THEN 'dispatch_exception'
            WHEN dt.status = 'picked_up' THEN 'picked_up'
            WHEN dt.status = 'in_transit' THEN 'en_route'
            WHEN rider.id IS NOT NULL THEN 'assigned'
            ELSE 'pending_dispatch'
        END,
        dt.pickup_time, dt.delivery_time, COALESCE(dt.estimated_minutes, 30),
        COALESCE(dt.actual_minutes, 0), dt.distance_km, dt.customer_feedback, dt.rating,
        COALESCE(dt.created_at, now())
    FROM public.delivery_tracking dt
    JOIN public.orders o ON o.id = dt.order_id AND o.restaurant_id = dt.restaurant_id
    LEFT JOIN public.staff rider ON rider.id = dt.rider_id AND rider.restaurant_id = dt.restaurant_id
        AND rider.is_active AND rider.role IN ('rider', 'delivery')
    WHERE o.order_type = 'delivery' AND NOT EXISTS (
        SELECT 1 FROM public.delivery_assignments da WHERE da.order_id = dt.order_id
    )
    ORDER BY dt.order_id, dt.created_at DESC NULLS LAST, dt.id DESC;

    REVOKE ALL ON public.delivery_tracking FROM PUBLIC, anon, authenticated;
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.delivery_tracking FROM service_role;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;

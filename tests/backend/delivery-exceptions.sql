-- Use disposable staging. Supply an active assigned delivery and a different rider.
-- psql -v assignment_id=... -v other_rider_id=... -f tests/backend/delivery-exceptions.sql
\set ON_ERROR_STOP on
BEGIN;

SELECT set_config('test.assignment_id', :'assignment_id', true),
       set_config('test.other_rider_id', :'other_rider_id', true);

DO $$
DECLARE
    assignment public.delivery_assignments%ROWTYPE;
    other_rider uuid := current_setting('test.other_rider_id')::uuid;
    result jsonb;
    payment_count bigint;
    event_count bigint;
BEGIN
    SELECT * INTO STRICT assignment FROM public.delivery_assignments
    WHERE id = current_setting('test.assignment_id')::uuid;

    IF assignment.rider_id IS NULL OR other_rider = assignment.rider_id
       OR assignment.status NOT IN ('assigned', 'picked_up', 'en_route', 'arrived') THEN
        RAISE EXCEPTION 'Use an active assigned delivery and a different rider';
    END IF;

    IF has_function_privilege('authenticated', 'public.report_delivery_exception(uuid,uuid,uuid,text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Browser role can call the internal delivery command';
    END IF;
    IF to_regclass('public.delivery_tracking') IS NOT NULL AND
       has_table_privilege('service_role', 'public.delivery_tracking', 'INSERT') THEN
        RAISE EXCEPTION 'Legacy table still accepts service-role writes';
    END IF;

    SELECT count(*) INTO payment_count FROM public.payments WHERE order_id = assignment.order_id;
    SELECT count(*) INTO event_count FROM public.restaurant_events
    WHERE aggregate_id = assignment.id AND event_type = 'DELIVERY_EXCEPTION_REPORTED';

    result := public.report_delivery_exception(assignment.restaurant_id, assignment.id, other_rider, 'Test issue');
    IF result->>'code' NOT IN ('forbidden', 'not_found') OR result->>'code' IS NULL THEN
        RAISE EXCEPTION 'Unassigned rider can change this delivery: %', result;
    END IF;
    result := public.report_delivery_exception(assignment.restaurant_id, assignment.id, assignment.rider_id, 'Test issue');
    IF result->>'status' IS DISTINCT FROM 'dispatch_exception' THEN RAISE EXCEPTION 'Exception report failed: %', result; END IF;
    result := public.report_delivery_exception(assignment.restaurant_id, assignment.id, assignment.rider_id, 'Test issue');
    IF result->>'success' IS DISTINCT FROM 'true'
       OR (SELECT count(*) FROM public.restaurant_events WHERE aggregate_id = assignment.id
           AND event_type = 'DELIVERY_EXCEPTION_REPORTED') <> event_count + 1
       OR (SELECT count(*) FROM public.payments WHERE order_id = assignment.order_id) <> payment_count THEN
        RAISE EXCEPTION 'Exception retry duplicated effects or posted a payment';
    END IF;
END;
$$;

ROLLBACK;

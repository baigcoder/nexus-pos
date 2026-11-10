-- Disposable staging only. Supply a pending assignment, an active manager, an active rider,
-- and a different restaurant's rider. The entire scenario is rolled back.
-- psql -v assignment_id=... -v manager_id=... -v rider_id=... -v other_rider_id=... -f tests/backend/secure-dispatch.sql
\set ON_ERROR_STOP on
BEGIN;

SELECT set_config('test.assignment_id', :'assignment_id', true),
       set_config('test.manager_id', :'manager_id', true),
       set_config('test.rider_id', :'rider_id', true),
       set_config('test.other_rider_id', :'other_rider_id', true);

DO $$
DECLARE
    v_assignment public.delivery_assignments%ROWTYPE;
    v_manager uuid := current_setting('test.manager_id')::uuid;
    v_rider uuid := current_setting('test.rider_id')::uuid;
    v_other_rider uuid := current_setting('test.other_rider_id')::uuid;
    v_result jsonb;
    v_events bigint;
BEGIN
    SELECT * INTO STRICT v_assignment FROM public.delivery_assignments
    WHERE id = current_setting('test.assignment_id')::uuid;
    IF v_assignment.status IS DISTINCT FROM 'pending_dispatch' THEN
        RAISE EXCEPTION 'Use a pending delivery assignment';
    END IF;

    IF has_table_privilege('authenticated', 'public.delivery_assignments', 'UPDATE')
       OR has_table_privilege('anon', 'public.delivery_assignments', 'SELECT')
       OR has_function_privilege('authenticated', 'public.assign_delivery_rider(uuid,uuid,uuid,uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Browser role has direct dispatch access';
    END IF;

    SELECT count(*) INTO v_events FROM public.restaurant_events
    WHERE aggregate_id = v_assignment.id AND event_type = 'DELIVERY_RIDER_ASSIGNED';

    v_result := public.assign_delivery_rider(v_assignment.restaurant_id, v_assignment.id, v_other_rider, v_manager);
    IF v_result->>'code' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'Cross-tenant rider accepted: %', v_result; END IF;

    v_result := public.assign_delivery_rider(v_assignment.restaurant_id, v_assignment.id, v_rider, v_rider);
    IF v_result->>'code' IS DISTINCT FROM 'forbidden' THEN RAISE EXCEPTION 'Rider could self-assign: %', v_result; END IF;

    v_result := public.assign_delivery_rider(v_assignment.restaurant_id, v_assignment.id, v_rider, v_manager);
    IF v_result->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Assignment failed: %', v_result; END IF;

    v_result := public.assign_delivery_rider(v_assignment.restaurant_id, v_assignment.id, v_rider, v_manager);
    IF v_result->>'success' IS DISTINCT FROM 'true' OR (
        SELECT count(*) FROM public.restaurant_events
        WHERE aggregate_id = v_assignment.id AND event_type = 'DELIVERY_RIDER_ASSIGNED'
    ) <> v_events + 1 THEN RAISE EXCEPTION 'Assignment retry duplicated the event: %', v_result; END IF;
END;
$$;

ROLLBACK;

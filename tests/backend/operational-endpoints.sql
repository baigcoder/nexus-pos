-- Run against disposable staging after 021, with a fresh restaurant, its owner,
-- a pending AI proposal from that restaurant, and a different restaurant ID.
-- psql -v restaurant_id=... -v owner_id=... -v proposal_id=... -v other_restaurant_id=... -f tests/backend/operational-endpoints.sql
\set ON_ERROR_STOP on
BEGIN;

SELECT set_config('test.restaurant_id', :'restaurant_id', true),
       set_config('test.owner_id', :'owner_id', true),
       set_config('test.proposal_id', :'proposal_id', true),
       set_config('test.other_restaurant_id', :'other_restaurant_id', true);

DO $$
DECLARE
    restaurant uuid := current_setting('test.restaurant_id')::uuid;
    owner_staff uuid := current_setting('test.owner_id')::uuid;
    proposal uuid := current_setting('test.proposal_id')::uuid;
    other_restaurant uuid := current_setting('test.other_restaurant_id')::uuid;
    template jsonb := '{"tables":[],"categories":[],"registers":[]}';
    first_result jsonb;
    result jsonb;
BEGIN
    IF restaurant = other_restaurant THEN RAISE EXCEPTION 'Use two different restaurants'; END IF;
    IF has_table_privilege('anon', 'public.restaurant_events', 'SELECT')
       OR has_table_privilege('authenticated', 'public.ai_action_proposals', 'UPDATE')
       OR has_function_privilege('authenticated', 'public.review_ai_proposal(uuid,uuid,uuid,text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Browser can bypass protected operational APIs';
    END IF;

    result := public.bootstrap_restaurant_template(other_restaurant, owner_staff, 'cafe', 'PKR', 16, template);
    IF result->>'code' IS DISTINCT FROM 'forbidden' THEN RAISE EXCEPTION 'Cross-restaurant setup accepted'; END IF;

    first_result := public.bootstrap_restaurant_template(restaurant, owner_staff, 'cafe', 'PKR', 16, template);
    IF first_result->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Setup failed: %', first_result; END IF;
    result := public.bootstrap_restaurant_template(restaurant, owner_staff, 'cafe', 'PKR', 16, template);
    IF result IS DISTINCT FROM first_result THEN RAISE EXCEPTION 'Setup retry changed the result'; END IF;
    result := public.bootstrap_restaurant_template(restaurant, owner_staff, 'cafe', 'PKR', 17, template);
    IF result->>'code' IS DISTINCT FROM 'conflict' THEN RAISE EXCEPTION 'Setup overwrote an existing setup'; END IF;

    result := public.review_ai_proposal(other_restaurant, owner_staff, proposal, 'reject');
    IF result->>'code' IS DISTINCT FROM 'forbidden' THEN RAISE EXCEPTION 'Cross-restaurant review accepted'; END IF;
    result := public.review_ai_proposal(restaurant, owner_staff, proposal, 'reject');
    IF result->'proposal'->>'status' IS DISTINCT FROM 'rejected' THEN RAISE EXCEPTION 'Review failed: %', result; END IF;
    result := public.review_ai_proposal(restaurant, owner_staff, proposal, 'approve');
    IF result->>'code' IS DISTINCT FROM 'conflict' THEN RAISE EXCEPTION 'Already-reviewed proposal could be applied'; END IF;
END;
$$;

ROLLBACK;

-- Disposable staging only. Use an active kitchen display, active advertisement display,
-- one pending order from the kitchen restaurant, and one order from a different restaurant.
-- psql -v kitchen_display_id=... -v ad_display_id=... -v local_order_id=... -v other_order_id=... -f tests/backend/display-device-sessions.sql
\set ON_ERROR_STOP on
BEGIN;

SELECT set_config('test.kitchen_display_id', :'kitchen_display_id', true),
       set_config('test.ad_display_id', :'ad_display_id', true),
       set_config('test.local_order_id', :'local_order_id', true),
       set_config('test.other_order_id', :'other_order_id', true);

DO $$
DECLARE
    kitchen public.displays%ROWTYPE;
    ad public.displays%ROWTYPE;
    local_order uuid := current_setting('test.local_order_id')::uuid;
    other_order uuid := current_setting('test.other_order_id')::uuid;
    kitchen_code text := gen_random_uuid()::text;
    ad_code text := gen_random_uuid()::text;
    kitchen_session text := gen_random_uuid()::text;
    ad_session text := gen_random_uuid()::text;
    result jsonb;
BEGIN
    SELECT * INTO STRICT kitchen FROM public.displays WHERE id = current_setting('test.kitchen_display_id')::uuid;
    SELECT * INTO STRICT ad FROM public.displays WHERE id = current_setting('test.ad_display_id')::uuid;
    IF kitchen.type <> 'kitchen' OR ad.type <> 'advertisement' OR NOT kitchen.is_active OR NOT ad.is_active THEN
        RAISE EXCEPTION 'Use active kitchen and advertisement display fixtures';
    END IF;
    IF has_table_privilege('anon', 'public.display_device_sessions', 'SELECT')
       OR has_function_privilege('authenticated', 'public.display_device_order_transition(text,text,uuid,text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Browser can bypass the display API';
    END IF;

    INSERT INTO public.display_device_sessions (display_id, code_hash, pair_expires_at)
    VALUES (kitchen.id, kitchen_code, now() + interval '5 minutes'),
           (ad.id, ad_code, now() + interval '5 minutes');

    IF public.redeem_display_pairing(kitchen_code, kitchen.slug || '-wrong', kitchen_session) IS NOT NULL THEN
        RAISE EXCEPTION 'Code worked for the wrong slug';
    END IF;
    IF public.redeem_display_pairing(kitchen_code, kitchen.slug, kitchen_session) IS NULL
       OR public.redeem_display_pairing(ad_code, ad.slug, ad_session) IS NULL THEN
        RAISE EXCEPTION 'Pairing failed';
    END IF;
    IF public.redeem_display_pairing(kitchen_code, kitchen.slug, gen_random_uuid()::text) IS NOT NULL THEN
        RAISE EXCEPTION 'Pairing code could be reused';
    END IF;

    result := public.display_device_order_transition(ad_session, ad.slug, local_order, 'preparing');
    IF result->>'code' IS DISTINCT FROM 'forbidden' THEN RAISE EXCEPTION 'Ad device could change an order'; END IF;
    result := public.display_device_order_transition(kitchen_session, kitchen.slug, other_order, 'preparing');
    IF result->>'code' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'Cross-restaurant display access'; END IF;
    result := public.display_device_order_transition(kitchen_session, kitchen.slug, local_order, 'preparing');
    IF result->>'status' IS DISTINCT FROM 'preparing' THEN RAISE EXCEPTION 'Kitchen start failed: %', result; END IF;

    UPDATE public.displays SET is_active = false WHERE id = kitchen.id;
    UPDATE public.displays SET is_active = true WHERE id = kitchen.id;
    result := public.display_device_order_transition(kitchen_session, kitchen.slug, local_order, 'ready');
    IF result->>'code' IS DISTINCT FROM 'unauthorized' THEN RAISE EXCEPTION 'Re-enabled display revived revoked device'; END IF;
END;
$$;

ROLLBACK;

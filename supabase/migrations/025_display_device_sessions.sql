BEGIN;

SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.display_device_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_id uuid NOT NULL REFERENCES public.displays(id) ON DELETE CASCADE,
    code_hash text UNIQUE NOT NULL,
    pair_expires_at timestamptz NOT NULL,
    issued_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
    session_hash text UNIQUE,
    session_expires_at timestamptz,
    revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS display_device_sessions_display_id_idx
    ON public.display_device_sessions(display_id);

ALTER TABLE public.display_device_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.display_device_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.display_device_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_display_pairing(
    p_code_hash text, p_slug text, p_session_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_display public.displays%ROWTYPE;
    v_pair_id uuid;
BEGIN
    SELECT d.* INTO v_display
    FROM public.displays d JOIN public.display_device_sessions s ON s.display_id = d.id
    JOIN public.restaurants r ON r.id = d.restaurant_id
    WHERE s.code_hash = p_code_hash AND d.slug = p_slug AND d.is_active AND r.is_active
    FOR SHARE OF d, r;
    IF NOT FOUND THEN RETURN NULL; END IF;

    UPDATE public.display_device_sessions
    SET session_hash = p_session_hash, session_expires_at = now() + interval '30 days'
    WHERE code_hash = p_code_hash AND display_id = v_display.id
      AND pair_expires_at > now() AND session_hash IS NULL AND revoked_at IS NULL
    RETURNING id INTO v_pair_id;
    IF NOT FOUND THEN RETURN NULL; END IF;

    RETURN jsonb_build_object('slug', v_display.slug, 'name', v_display.name);
END;
$$;

CREATE OR REPLACE FUNCTION public.display_device_order_transition(
    p_session_hash text, p_slug text, p_order_id uuid, p_target text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_display public.displays%ROWTYPE;
    v_status text;
    v_result jsonb;
BEGIN
    SELECT d.* INTO v_display
    FROM public.displays d JOIN public.display_device_sessions s ON s.display_id = d.id
    JOIN public.restaurants r ON r.id = d.restaurant_id
    WHERE s.session_hash = p_session_hash AND s.session_expires_at > now()
      AND s.revoked_at IS NULL AND d.slug = p_slug AND d.is_active AND r.is_active
    FOR SHARE OF d, r;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'unauthorized', 'error', 'Pair this device first');
    END IF;
    -- Lock the credential after the display, matching the revocation path.
    PERFORM id FROM public.display_device_sessions
    WHERE session_hash = p_session_hash AND display_id = v_display.id
      AND session_expires_at > now() AND revoked_at IS NULL FOR SHARE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'unauthorized', 'error', 'Pair this device first');
    END IF;
    IF v_display.type <> 'kitchen' OR p_target IS NULL OR p_target NOT IN ('preparing', 'ready') THEN
        RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'error', 'Display cannot perform this action');
    END IF;

    SELECT status INTO v_status FROM public.orders
    WHERE id = p_order_id AND restaurant_id = v_display.restaurant_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'not_found', 'error', 'Order not found');
    END IF;

    v_result := public.transition_kitchen_order(v_display.restaurant_id, p_order_id, p_target, NULL);
    IF COALESCE((v_result->>'success')::boolean, false) AND v_status IS DISTINCT FROM p_target THEN
        INSERT INTO public.restaurant_events (restaurant_id, aggregate_type, aggregate_id, event_type, payload)
        VALUES (v_display.restaurant_id, 'ORDER', p_order_id, 'DISPLAY_ORDER_COMMAND',
                jsonb_build_object('display_id', v_display.id, 'status', p_target));
    END IF;
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_changed_display_devices()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF (OLD.is_active AND NOT NEW.is_active) OR OLD.type IS DISTINCT FROM NEW.type
       OR OLD.restaurant_id IS DISTINCT FROM NEW.restaurant_id OR OLD.slug IS DISTINCT FROM NEW.slug THEN
        UPDATE public.display_device_sessions SET revoked_at = now()
        WHERE display_id = OLD.id AND revoked_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS revoke_changed_display_devices ON public.displays;
CREATE TRIGGER revoke_changed_display_devices AFTER UPDATE ON public.displays
FOR EACH ROW EXECUTE FUNCTION public.revoke_changed_display_devices();

REVOKE EXECUTE ON FUNCTION public.revoke_changed_display_devices() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_display_pairing(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_display_pairing(text, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.display_device_order_transition(text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.display_device_order_transition(text, text, uuid, text) TO service_role;

REVOKE ALL ON public.displays, public.ad_content FROM PUBLIC, anon;
DO $$
BEGIN
    IF to_regclass('public.display_screens') IS NOT NULL THEN
        REVOKE ALL ON public.display_screens FROM PUBLIC, anon, authenticated;
    END IF;
    IF to_regclass('public.screen_content') IS NOT NULL THEN
        REVOKE ALL ON public.screen_content FROM PUBLIC, anon;
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;

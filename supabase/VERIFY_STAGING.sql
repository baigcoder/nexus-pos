-- Read-only checks for the manually applied NexusPOS upgrade bundles.
-- A present signature does not verify migration history, data, or runtime behavior.
WITH checks(migration, feature, present) AS (
    VALUES
        ('017–018', 'Tenant-scoped payments', to_regprocedure('public.settle_restaurant_order_payment(jsonb)') IS NOT NULL),
        ('018', 'Kitchen transition', to_regprocedure('public.transition_kitchen_order(uuid,uuid,text,uuid)') IS NOT NULL),
        ('018', 'Delivery transition', to_regprocedure('public.transition_delivery_assignment(uuid,uuid,text,uuid,boolean)') IS NOT NULL),
        ('019', 'Secure dispatch', to_regprocedure('public.assign_delivery_rider(uuid,uuid,uuid,uuid)') IS NOT NULL),
        ('020', 'Rider cash collection', to_regprocedure('public.complete_delivery_with_cash(uuid,uuid,uuid,boolean,numeric)') IS NOT NULL),
        ('020', 'Register cash reconciliation', to_regprocedure('public.reconcile_delivery_cash(uuid,uuid,uuid)') IS NOT NULL),
        ('021', 'Atomic restaurant onboarding', to_regprocedure('public.bootstrap_restaurant_template(uuid,uuid,text,text,numeric,jsonb)') IS NOT NULL),
        ('021', 'Protected AI proposal review', to_regprocedure('public.review_ai_proposal(uuid,uuid,uuid,text)') IS NOT NULL),
        ('022', 'Signup email verification', to_regprocedure('public.find_signup_user_by_email(text)') IS NOT NULL),
        ('023', 'Atomic checkout', to_regprocedure('public.create_checkout_order(jsonb)') IS NOT NULL),
        ('024', 'Delivery exception handling', to_regprocedure('public.report_delivery_exception(uuid,uuid,uuid,text)') IS NOT NULL),
        ('025', 'One-time display pairing', to_regprocedure('public.redeem_display_pairing(text,text,text)') IS NOT NULL),
        ('025', 'Device kitchen authorization', to_regprocedure('public.display_device_order_transition(text,text,uuid,text)') IS NOT NULL),
        ('026', 'Signed table checkout gate', to_regprocedure('public.create_verified_checkout_order(jsonb)') IS NOT NULL),
        ('027', 'Database-clock device pairing', to_regprocedure('public.issue_display_pairing(uuid,uuid,uuid,text)') IS NOT NULL),
        ('027', 'Database-clock device session validation', to_regprocedure('public.active_display_device(text)') IS NOT NULL)
)
SELECT migration, feature, CASE WHEN present THEN 'PRESENT' ELSE 'MISSING' END AS status
FROM checks
ORDER BY migration, feature;

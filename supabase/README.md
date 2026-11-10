# Supabase SQL

Apply scripts against a target environment in this order:

1. `schema.sql` (fresh databases only)
2. Numbered files in `migrations/` (`002` through `011`)
3. Feature SQL at the repo root only if a numbered migration does not already cover that table

Do not run every root `.sql` file on an existing production database. `011_production_hardening.sql` is additive and safe to re-run.

PIN-only staff authenticate through signed `staff_session` cookies and API routes. Browser Supabase queries work for owners and staff who have a `user_id` linked to `auth.users`.

## Signed table ordering

Apply `migrations/026_table_qr_credentials.sql` after 023 and deploy the matching app. Generate and reprint codes in **QR Ordering**. Old number-only links can still display the menu, but cannot submit a table order. **Replace QR code** revokes the prior print. Disabling or re-enabling QR ordering also rotates the code. Set a stable `TABLE_QR_SECRET` across app instances. Rotating that secret invalidates every existing printed table code.

Run `tests/backend/table-qr.sql` on disposable staging. Scan the new QR, submit a test order, replace the code, and verify the previous print and a link modified to use a different table both fail.

## Owner password recovery

In Supabase Authentication, add the staging and production app URLs ending in `/reset-password` to the redirect allow list. In the Reset Password email template, use this link:

```html
<a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}">Reset your password</a>
```

Keep the token in the URL fragment so requests to the app page do not carry it. The app verifies a recovery token before updating the password. On staging, request a reset for a disposable owner, follow the email link, set a new password, and confirm that the old password and the used reset link both fail.

## Dedicated display devices

Apply `migrations/025_display_device_sessions.sql` after 018, then apply `migrations/027_display_database_clock.sql` before deploying the matching app. Both pairing expiry and device session validity use the PostgreSQL clock. In Display Manager, open a display's menu and select **Pair device**. On the device, open `/screen-login` and enter the display slug and one-time code. Codes expire after ten minutes. A paired device session expires after 30 days. To revoke a session, select **Disconnect devices** or disable the display. Existing legacy screen codes cannot be used after the cutover. Recreate any legacy-only screens in Display Manager before replacing their links.

Run `tests/backend/display-device-sessions.sql` on staging and test pairing, device refresh, and revocation with the app. Kitchen devices can start and mark their restaurant's orders ready. Other device types receive read-only manifests, and manager preview is read-only. Bar, counter, and cashier displays show ready order numbers. Ad and waiting displays load scheduled slides. Browser clients cannot access device credentials or the legacy screen registry directly.

## Legacy delivery cutover

After 020 and 023, apply `migrations/024_unify_legacy_delivery.sql` and deploy the matching app during the same cutover. The migration copies legacy deliveries that have no canonical assignment and removes direct writes to the old tracking table. Review orders with records in both tables before cutover. The migration preserves existing assignments and does not reconcile historical rider cash.

Use `tests/backend/delivery-exceptions.sql` with disposable staging fixtures. Verify both delivery API paths read the same assignments, confirm that a rider cannot request an owner dashboard, and confirm that a delivery failure does not post a payment.

## Atomic checkout

Apply `migrations/023_atomic_checkout_requests.sql` before deploying the matching app. Storefront, embed, waiter, and POS clients send a UUID request key. Integrations should send a stable UUID in `Idempotency-Key` for each new order and retain it across retries. An existing key with changed order details returns 409. Requests without a key can still create orders for compatibility and have no replay guarantee.

Checkout prices selected modifier IDs from the item's stored options and takes the flat delivery fee from restaurant `settings.delivery_fee`, defaulting to zero. The embedded confirmation keeps the signed tracking link inside the order surface. The parent notification contains the order number only.

Run `tests/backend/atomic-checkout-requests.sql` on disposable staging and repeat a keyed order submission from two concurrent sessions. Confirm that a rejected basket leaves the table unchanged and that a successful retry returns the original order and tracking link.

## Owner signup

Apply `migrations/022_signup_verification.sql` before deploying the updated registration flow. Keep email confirmation enabled in Supabase Auth. Custom verification codes issued by the current app are hashed. Older plaintext codes must be reissued. Verification confirms the email, then the owner signs in to establish a session and continue to setup.

New restaurants use Starter with no trial end or paid staff-seat gate. Existing dated trials keep their terms. Avoid reapplying migration 011 to a live database because its legacy backfill can assign a trial date to permanent free restaurants.

## Operational API authorization

Apply `migrations/021_protect_operational_endpoints.sql` with the matching app. Restaurant template setup is owner-only and can be repeated with the same settings. Event inspection and AI proposals require a manager or owner. Integrations must authenticate and use their own restaurant context. The raw event and proposal tables are server-only.

On staging, verify that all three APIs reject unauthenticated and cross-restaurant requests and that ordinary staff cannot access manager operations. Run `tests/backend/operational-endpoints.sql` on disposable fixtures to verify proposal review and onboarding replay behavior.

## Cash on delivery

For SQL Editor deployments that already applied the repair and upgrade bundle through 018, run `NEXUSPOS_DISPATCH_AND_CASH_UPGRADE.sql` on staging. It applies 019 and 020 in one transaction. If you use the migration runner, apply 019 and then 020 instead. Release the matching app with the database changes. New public delivery orders use cash on delivery. The assigned rider confirms the exact outstanding amount at delivery. A cashier or manager confirms physical receipt in Delivery Monitor, which posts the cash to the existing settlement and register ledgers. Standard billing excludes COD orders. Existing orders retain their original payment method, and historical rider collections are not automatically reconciled.

Run `tests/backend/cash-on-delivery.sql` against disposable staging fixtures and try a cash handoff through both screens. The current workflow handles full outstanding balances. Cash shortages, partial rider collections and legacy handoffs require an exception workflow.

## Dispatch follow-up

On databases that have already applied the repair and upgrade bundle, apply `migrations/019_secure_dispatch.sql` once on staging. Deploy the matching app in the same cutover window because the migration removes direct browser writes to delivery assignments. Run `tests/backend/secure-dispatch.sql` with disposable fixtures before applying the same migration to production.

## Order access rollout

Reconcile the environment's migration history before applying new SQL. For an existing database with the backend foundation through 016, use `NEXUSPOS_BACKEND_UPGRADE.sql` in the Supabase SQL Editor. It applies 017 and 018 in one transaction and checks the required tables and functions first. For environments managed through the migration CLI, apply the numbered migrations through the migration runner. Use one method per environment. If GPS scripts are installed separately, install them before this upgrade. Verify function grants for `anon`, `authenticated`, and `service_role` on staging.

Set `ORDER_ACCESS_SECRET` to a distinct high-entropy server secret on every app instance. Customer checkout returns `status_url` and `tracking_url` for newly created orders. The links contain seven-day credentials in a fragment. Integrations that fetch order status directly must send that credential as an `Authorization: Bearer` header. Order numbers and UUIDs alone cannot be used to retrieve status. Number-only links issued by older versions expire at this cutover. Customer messaging continues without those legacy links. A creation replay does not reissue a credential.

Apply the database upgrade and release the updated cashier, kitchen and rider screens together during a cutover window. The migration removes direct browser writes to `payments`. Run the rollback-only `tests/backend/atomic-checkout.sql` regression against a disposable staging database using a fresh pending order, an active cashier at that restaurant, and the ID of a second restaurant. Also test two sessions submitting the same payment key concurrently, a kitchen screen reconnecting after a lost response, and a table with multiple unpaid orders. Payments with nonzero tips use the separate tips workflow. Card and mobile selections record externally collected tenders.

In staging, create an order and check both links, submit feedback for that order, and verify that requests without a valid link fail. Check that a cashier from a different restaurant cannot settle the order. Exercise rider pickup, GPS updates for the active assignment, and completion. Verify that a second customer cannot read the first order's status or GPS history and that customer GPS stops after delivery.

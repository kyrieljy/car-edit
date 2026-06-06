# TODO

Last updated: 2026-06-06 Asia/Shanghai

Short active queue. Start with `PROJECT_CONTEXT.md`; do not bulk-read `docs/` unless a linked topic is needed.

## P0 - Deploy Latest Main To Test Server

Latest pushed commit:

```text
5d796f5 Make admin plan override subscriptions
```

Deploy:

```bash
cd /root/car-edit
git pull
npm run build
pm2 restart car-edit --update-env
```

Expected smoke checks after deploy:

- Login/register/reset/admin verification still work with mock SMS in local dry-run and configured Aliyun SMS on the server.
- H5 one-tap gracefully falls back to SMS when carrier token fetch is unavailable.
- Self-service subscription buttons stay disabled and show the managed-by-admin copy.
- `/api/billing/status` follows the admin-saved `users.plan`; a stale active subscription must not make a `free` user appear as `pro`.
- Admin user management table does not horizontally overflow on the current desktop view.
- Secondary admin `admin_16698604646 / Admin@1234` can log in with admin verification and has unlimited internal quota.

## P0 - Guard Account, Billing, And Auth Invariants

For any change touching account/login/billing/admin users:

- Do not run real SMS, real one-tap carrier auth, or real payment tests without explicit user approval; these can cost money.
- Local auth tests should keep `SMS_PROVIDER=mock` and `PHONE_ONE_TAP_PROVIDER=mock`.
- Test-build subscription purchase remains disabled until real payment/webhook/refund/idempotency are implemented.
- Admin user `plan` is the source of truth for billing entitlements.
- Saving a user plan from admin should cancel stale active subscriptions so the UI cannot drift back to an old paid plan.
- Internal/admin users should show unlimited config and chat quota.

Useful checks:

```powershell
npx.cmd tsc --noEmit
node scripts\auth-flow-dry-run-tests.mjs
npm.cmd run build
```

## P0 - Guard Prompt And History Invariants

For any change touching prompt/history:

- Runtime prompt source remains Git seed in `lib/catalog.ts`.
- `config/prompt-packs` is validation evidence only.
- Admin/config migration must not create, update, export, import, or apply prompt bodies.
- Auto-recognized vehicle model must not enter `GenerationStandardJson.vehicle.model`.
- History titles should use `displayVehicleModel` when available and never show internal ids such as `gen_...`.

Useful checks:

```powershell
npm.cmd run prompt:validate
npm.cmd run build
npx.cmd tsc --noEmit
```

Run `prompt:validate` only when prompt assets/templates are touched.

## P1 - Image And Provider QA

Use existing records where possible:

- Generated images display from app-local/proxied paths.
- Chat upload/result/continue flows preserve local image paths.
- Download/export uses app-origin helpers and does not navigate to provider URLs.
- Old raw provider URLs may be expired; do not treat unrecoverable historical records as current bugs.

Real provider tests require explicit approval. Before a paid test, confirm latest commit is deployed, provider key exists, and `APP_URL` / `PROVIDER_PUBLIC_BASE_URL` point to the test server.

## P1 - Mobile Performance Pass

The mobile H5 UI feels somewhat low-framerate on real phones. Before moving to mini program or native app, profile the production build on an actual phone and reduce obvious H5 paint costs:

- large full-screen blur/backdrop-filter/shadow layers
- unnecessary layout shifts or React rerenders during modal/input interactions
- heavy mobile drawer/login animations
- oversized images or uncompressed assets

Wrapping the same H5 in a WebView app or mini program is not expected to fix performance by itself.

## P2 - Production Gaps

Still prototype-only:

- production-grade SMS and WeChat OAuth operations
- production-grade H5/native one-tap carrier auth handling
- real payment/webhook/refund/idempotency
- production DB/object storage/CDN/backups
- production operations console for users/orders/quota/provider cost
- stronger admin audit and runtime-config safety

## Verification Commands

Docs only:

```powershell
git diff --check
git status --short
```

Code:

```powershell
npm.cmd run build
npx.cmd tsc --noEmit
```

Chat logic:

```powershell
node scripts\chat-mode-dry-run-tests.mjs
```

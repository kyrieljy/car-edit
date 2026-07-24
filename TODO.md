# TODO

Last updated: 2026-06-29 Asia/Shanghai

Short active queue. Start with `PROJECT_CONTEXT.md`; do not bulk-read `docs/` unless a linked topic is needed.

## P0 - Finish Second-Round Local QA

Current second-round Web/H5 changes are local only. Do not push, commit, or deploy until the user explicitly asks.

Before considering the local round ready:

- Re-check PC and mobile accessory selection flows after each UI change.
- Confirm wheel selection still uses its original card style and defaults to unselected.
- Confirm caliper color and rotor-style choices appear under each selected caliper, can be cancelled, and appear in prompt/summary output.
- Confirm rear wing, front splitter, side skirt, exhaust, and dry carbon parts all use the intended inline category logic instead of old "brand/model" detail blocks.
- Confirm front splitter and side skirt keep backend reference images but show no mobile preview eye.
- Confirm bottom accordion expansion scrolls to the first visible option, not to the menu bottom.
- Confirm mobile category rows remain compact and do not overlap expanded content.
- Confirm admin asset/reference image layout is not broken by the new style-asset logic.

Useful checks:

```powershell
git diff --check
npx.cmd tsc --noEmit
npm.cmd run build
```

## P0 - Guard Prompt, JSON, And Color Invariants

For any change touching prompt/history/color:

- Runtime prompt source remains Git seed in `lib/catalog.ts`.
- `config/prompt-packs` is validation evidence only.
- Admin/config migration must not create, update, export, import, or apply prompt bodies.
- Auto-recognized vehicle model must not enter `GenerationStandardJson.vehicle.model`.
- Recognition should only choose/show classic colors. User-edited brand/model text can switch classic color matching.
- If recognition is pending or no brand keyword matches backend config, show the default classic color list.
- History titles should use `displayVehicleModel` when available and never show internal ids such as `gen_...`.

Useful checks:

```powershell
npm.cmd run prompt:validate
node scripts\chat-mode-dry-run-tests.mjs
npx.cmd tsc --noEmit
```

Run `prompt:validate` only when prompt assets/templates are touched.

## P0 - Accessory Dry-Run Coverage

Keep `scripts\chat-mode-dry-run-tests.mjs` aligned with the second-round UI and standard JSON contract. It should cover at least:

- caliper color and rotor style
- rear wing style and black/carbon/body-color material
- front splitter and side skirt install/material
- exhaust final leaf layouts, including left/right and center 1/2/4 exits
- dry carbon multi-select
- classic paint matching default vs brand-specific list
- height unchanged/raised/racing 0-finger/air suspension

## P1 - Account, Billing, And Auth Invariants

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

## P1 - Product Gaps Before Release

Still needed before a serious external release:

- Implement any remaining second-version business requirements from product testing.
- Polish the new PC personal management page, mobile personal management page, and edit page so they do not look AI-generated.
- Plan and run database migration instead of relying on local SQLite/runtime drift.
- Add stable login channels beyond the current test scaffolding.
- Integrate real payment, webhook, refund, reconciliation, and idempotency.
- Run security testing and add missing security controls.
- Run pressure/load testing with realistic generation, upload, and chat traffic.
- Prepare gray release/deployment rollback process.

## P2 - Multi-End Strategy

Future mini program, iOS app, and Android app work needs a product/tech decision before starting native rewrites:

- Decide whether H5 can remain the shared core with thin shells, or whether a cross-platform stack such as React Native/Taro/uni-app is worth migrating to.
- If native Swift/Kotlin is required, define what stays shared: API contracts, prompt/JSON schema, catalog data, assets, and admin configuration.
- Avoid starting three independent UI implementations before the accessory and prompt contracts stabilize.

## P2 - Image And Provider QA

Use existing records where possible:

- Generated images display from app-local/proxied paths.
- Chat upload/result/continue flows preserve local image paths.
- Download/export uses app-origin helpers and does not navigate to provider URLs.
- Old raw provider URLs may be expired; do not treat unrecoverable historical records as current bugs.

Real provider tests require explicit approval. Before a paid test, confirm latest commit is deployed, provider key exists, and `APP_URL` / `PROVIDER_PUBLIC_BASE_URL` point to the test server.

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

Prompt and Chat logic:

```powershell
npm.cmd run prompt:validate
node scripts\chat-mode-dry-run-tests.mjs
```

Auth logic:

```powershell
node scripts\auth-flow-dry-run-tests.mjs
```

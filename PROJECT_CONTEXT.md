# PROJECT_CONTEXT

Last updated: 2026-06-06 Asia/Shanghai

Compact handoff for `car-mod-effect-studio`. New Codex windows should read this file first, then `TODO.md`. Open `ARCHITECTURE.md`, `DECISIONS.md`, or `docs/README.md` only when the task needs that context.

## Snapshot

- Local path: `D:\car-mod-effect-studio`
- GitHub: `https://github.com/kyrieljy/car-edit.git`
- Branch: `main`
- Latest pushed commit: `5d796f5 Make admin plan override subscriptions`
- Test server URL: `http://47.106.182.116:3000/`
- Test server path: `/root/car-edit`
- Stack: Next.js 14 App Router, React 18, TypeScript, Framer Motion, Lucide, local SQLite via experimental `node:sqlite`

Default local accounts:

- Demo: `demo / Demo@1234`
- Admin: `admin / Admin@1234`
- Secondary admin: `admin_16698604646 / Admin@1234`

## Current State

The app is an AI car modification render prototype with desktop UI, mobile app-style UI, Chat Mode, and `/admin`.

Current `main` includes:

- Prompt authority locked to Git seed: runtime prompt text comes from `lib/catalog.ts` (`promptSeed` / `promptTemplateSeed`) and is validated by `config/prompt-packs`.
- Admin prompt surfaces are read-only; prompt mutating APIs return 405; config export/apply ignores prompt bodies.
- SQLite prompt tables remain only for schema compatibility.
- Config history display uses `displayVehicleModel` metadata and filters internal ids such as `gen_...`.
- Auto-recognized vehicle model is display/history metadata only; only a user-edited model may enter `GenerationStandardJson.vehicle.model`.
- Mobile Chat has recently been polished: one-line composer placeholder, capped multiline growth, `+` upload menu, image preview strip, bottom scroll-to-latest, drawer layering, no mobile drawer search, avatar/menu/banner fixes, and stable mode switch position.
- Phone auth work is in place for SMS code login/register/reset/admin verification and H5 one-tap token exchange. Local dry-runs use mock SMS/one-tap providers; do not run real Aliyun provider tests without explicit approval.
- Self-service subscription purchase is disabled for the test build. Subscription buttons are disabled and checkout/mock-paid APIs return `SUBSCRIPTION_MANAGED_BY_ADMIN`; users must be configured by an admin.
- Admin user management is the source of truth for role, plan, status, and quota adjustments. `users.plan` is authoritative for billing status; stale active subscription rows must not override an admin-saved plan.
- Internal/admin plans return unlimited config and chat quota. The seeded secondary admin `admin_16698604646` is configured as admin/internal.
- The admin user table had recent layout fixes for quota controls, but mobile/front-end performance has not yet had a dedicated profiling pass.

After the latest account/billing fixes, local verification passed:

```powershell
git diff --check
npx.cmd tsc --noEmit
node scripts\auth-flow-dry-run-tests.mjs
npm.cmd run build
```

No real provider generation, real SMS send, real one-tap carrier request, or real payment was run for the latest checks.

## Boundaries

Do not treat SQLite as source code.

Code is authoritative for:

- default providers/workflows/catalog/prompt/billing/guardrail baselines
- prompt version assets and validation
- UI/API behavior

SQLite is runtime state for:

- provider keys and runtime admin overrides
- users, sessions, billing, messages
- uploads, generation/chat/history/failure/audit records
- old prompt tables kept for compatibility only

Important invariants:

- `GenerationStandardJson.vehicle.model` affects prompt generation; keep it empty unless the user manually edits the vehicle model.
- `GenerationJob.displayVehicleModel` / `generation_jobs.display_vehicle_model` is display-only metadata.
- New durable images should be app-local paths such as `/results/...` or `/uploads/...`, not raw provider-hosted URLs.
- Real provider failures must be visible; do not substitute mock/original/demo images as successful output.
- Billing entitlement checks should read the admin-saved `users.plan`; active subscription records are history/runtime state and must not silently override admin settings.
- Test-build subscription upgrades are admin-managed only until real payment/webhook/idempotency are implemented.

API keys are encrypted with environment secrets. Copying SQLite between local and server can break provider key decryption if secrets differ.

## Deployment

Typical test-server update:

```bash
cd /root/car-edit
git pull
npm run build
pm2 restart car-edit --update-env
```

If dependencies changed, run `npm ci` before build. The latest commits did not add dependencies.

Useful checks:

```bash
git log --oneline -5
pm2 list
pm2 logs car-edit --lines 200
```

Public provider image tests need the server origin:

```text
APP_URL=http://47.106.182.116:3000
PROVIDER_PUBLIC_BASE_URL=http://47.106.182.116:3000
```

Do not paste real API keys into chat.

## Working Rules

- Start from the newest user request.
- Use `rg` before reading/editing large files.
- Use `apply_patch` for manual edits.
- Keep mobile/desktop UI fixes scoped unless shared logic is the cause.
- Do not reset or commit SQLite without explicit approval.
- Do not run real provider tests without explicit approval; failed submits may still charge credits.
- Do not commit runtime DB files, uploads/results, artifacts, or secrets.

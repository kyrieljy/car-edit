# PROJECT_CONTEXT

Last updated: 2026-06-29 Asia/Shanghai

Compact handoff for `car-mod-effect-studio`. New Codex windows should read this file first, then `TODO.md`. Open `ARCHITECTURE.md`, `DECISIONS.md`, or `docs/README.md` only when the task needs that context.

## Snapshot

- Local path: `D:\car-mod-effect-studio`
- GitHub: `https://github.com/kyrieljy/car-edit.git`
- Branch: `main`
- Current tracked base: `a4646b8 Update handoff docs`
- Current local state: large uncommitted second-round Web/H5 changes; do not push or commit unless explicitly requested.
- Test server URL: `http://47.106.182.116:3000/`
- Test server path: `/root/car-edit`
- Stack: Next.js App Router, React, TypeScript, Framer Motion, Lucide, local SQLite via experimental `node:sqlite`

Default local accounts:

- Demo: `demo / Demo@1234`
- Admin: `admin / Admin@1234`
- Secondary admin: `admin_16698604646 / Admin@1234`

## Current State

The app is an AI car modification render prototype with desktop UI, mobile app-style UI, Chat Mode, and `/admin`.

The tracked base already includes prompt lock-down, repo slimming, Config history display fixes, mobile Chat UI polish, Aliyun SMS/H5 one-tap scaffolding, admin-managed subscriptions, secondary admin seeding, and account/billing fixes.

The active local work is the second-round Web/H5 test-build change set. It is not committed, not pushed, and not deployed. Main local scope:

- PC upload surfaces and Chat image entry support clipboard image paste, while avoiding hijacking text inputs.
- Front-facing accessory categories are reduced to wheels, calipers, rear wings, front splitters, side skirts, exhaust, and dry carbon parts.
- Wheels keep their original card/SKU selection pattern and default to unselected.
- Calipers keep SKU cards and now include inline color and rotor-style controls. Rotor styles are unchanged, enlarged brake rotor, and carbon ceramic rotor.
- Rear wings are fixed style assets: Ducktail, Lip Spoiler, GT Wing, Swan Neck, and Time Attack. Each supports black, carbon fiber, or body color under the selected item, with help popovers.
- Front splitters and side skirts are install toggles with black, carbon fiber, or body color options under the category. Reference images remain admin-configured; mobile does not show the preview eye.
- Exhaust is a list-style layout picker with grouped options: single-side single exit left/right, single-side dual exit left/right, dual-side dual exit, dual-side single exit, and center 1/2/4 exits.
- Dry carbon parts moved into accessory selection and support multi-select for hood, mirrors, fenders, and trunk lid.
- Color now supports backend-configured default classic colors and brand-keyword classic color sets. Recognition and user-edited brand/model text switch the displayed classic color list.
- Height options are unchanged, raised, racing 0-finger, and air suspension.
- Prompt seed, standard JSON, category aliases, and Chat dry-run tests have been updated for the new accessory logic.
- Admin asset management has been adjusted for style assets and reference images; local SQLite/runtime state may affect what the admin page shows.

## Key Invariants

Do not treat SQLite as source code.

Code is authoritative for:

- default providers/workflows/catalog/prompt/billing/guardrail baselines
- prompt version assets and validation
- UI/API behavior

SQLite is runtime state for:

- provider keys and runtime admin overrides
- users, sessions, billing, messages
- uploads, generation/chat/history/failure/audit records
- local admin asset/reference-image overrides
- old prompt tables kept for compatibility only

Important invariants:

- Auto-recognized vehicle model is display metadata and classic-paint matching input only. Do not write it to `GenerationStandardJson.vehicle.model`.
- If the user edits the recognized brand/model text, use that keyword for classic-paint matching. If recognition is pending or no keyword matches, show the default classic color list.
- `GenerationJob.displayVehicleModel` / `generation_jobs.display_vehicle_model` is display-only metadata.
- New durable images should be app-local paths such as `/results/...` or `/uploads/...`, not raw provider-hosted URLs.
- Real provider failures must be visible; do not substitute mock/original/demo images as successful output.
- Billing entitlement checks should read the admin-saved `users.plan`; active subscription records are history/runtime state and must not silently override admin settings.
- Test-build subscription upgrades are admin-managed only until real payment/webhook/idempotency are implemented.

API keys are encrypted with environment secrets. Copying SQLite between local and server can break provider key decryption if secrets differ.

## Local Development

Use one dev server per port. A duplicate Next dev process on `3000` has caused confusing `404: This page could not be found` and stale `_next/static` behavior. If the browser looks wrong, check listeners before debugging React:

```powershell
netstat -ano | findstr :3000
```

Then keep only the intended process. The normal local command is:

```powershell
npm.cmd run dev -- -H 0.0.0.0 -p 3000
```

## Deployment

Do not deploy the current second-round local work unless the user explicitly asks. A normal server `git pull` will only deploy pushed Git history, not the current local dirty worktree.

Typical test-server update after an intentional commit/push:

```bash
cd /root/car-edit
git pull
npm run build
pm2 restart car-edit --update-env
```

If dependencies changed, run `npm ci` before build.

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
- Do not run real provider, real SMS, real carrier one-tap, or real payment tests without explicit approval.
- Do not commit runtime DB files, uploads/results, artifacts, or secrets.

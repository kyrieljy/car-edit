# AGENTS

Last updated: 2026-06-29 Asia/Shanghai

Small entrypoint for the next Codex window.

## Read Order

Read:

1. `PROJECT_CONTEXT.md`
2. `TODO.md`

Only open when needed:

3. `ARCHITECTURE.md`
4. `DECISIONS.md`
5. `docs/README.md`

Do not bulk-read `docs/`, `skills/`, or `prototypes/`.

## Current Handoff

Current tracked base:

```text
a4646b8 Update handoff docs
```

There is a large local, uncommitted second-round Web/H5 test-build change set. The user explicitly asked to implement locally first and not push. Do not commit or push unless the user explicitly asks.

The local dirty set currently spans shared PC/mobile UI, admin asset configuration, catalog/prompt/standard JSON logic, dry-run tests, and new local test assets. Start every new task from the newest user message and verify the exact current diff before editing.

Second-round scope already under local work:

- PC and mobile accessory selection redesign.
- Clipboard image paste in PC upload surfaces.
- New accessory whitelist and option logic for wheels, calipers, rear wings, front splitters, side skirts, exhaust, and dry carbon parts.
- Brand/default classic paint configuration and brand-keyword color switching.
- Height options changed to unchanged, raised, racing 0-finger, and air suspension.
- Prompt, standard JSON, category alias, and dry-run coverage updates.

Admin billing rule remains: `users.plan` is authoritative. Stale active subscription rows must not override a plan saved from the admin user table.

## Hard Boundaries

- Do not run real provider, real SMS, real one-tap carrier, or real payment tests without explicit user approval.
- Do not push, commit, or deploy the current local second-round changes unless explicitly requested.
- Do not put auto-recognized vehicle model into `GenerationStandardJson.vehicle.model`; use recognition only for display and classic-paint matching. Only a user-edited model/brand may enter prompt JSON when required by product logic.
- Prompt text is managed from Git seed (`lib/catalog.ts`) and validated by `config/prompt-packs`; SQLite prompt rows are compatibility data only.
- Test-build subscription upgrades are admin-managed only; do not re-enable checkout/mock-paid without explicit user direction.
- Do not commit runtime DB files, uploads/results, artifacts, or secrets.
- Keep PC and mobile UI differences intentional. Do not assume a mobile-only UI request should change PC, or vice versa.

## How To Work

1. Start from the newest user request.
2. Use `rg` before reading/editing large files.
3. Keep edits narrow and aligned with existing patterns.
4. Use `apply_patch` for manual edits.
5. Run relevant verification.
6. Ask before any real provider call and mention possible credit usage.

## Key Files

- Shared app controller: `components/car-mod-studio.tsx`
- Mobile shell/config/chat: `components/mobile/mobile-studio-app.tsx`
- Chat UI and chat drawer: `components/chat-mode.tsx`
- Admin console: `components/admin-console.tsx`
- Workflow designer: `components/workflow-designer.tsx`
- Catalog, aliases, generation contracts: `lib/catalog.ts`, `lib/part-category-aliases.ts`, `lib/generation-core.ts`, `lib/types.ts`
- SQLite/runtime config/history: `lib/server/db.ts`
- Classic paint admin API: `app/api/admin/classic-paints/`
- Provider execution: `lib/server/generation-provider.ts`
- Image materialization/proxy/download: `lib/server/image-materializer.ts`, `lib/server/image-assets.ts`, `lib/client/image-download.ts`
- Global/mobile CSS overrides: `app/globals.css`
- Chat dry-run coverage: `scripts/chat-mode-dry-run-tests.mjs`

## Verification

From `D:\car-mod-effect-studio`:

```powershell
git diff --check
npm.cmd run build
npx.cmd tsc --noEmit
node scripts\chat-mode-dry-run-tests.mjs
node scripts\auth-flow-dry-run-tests.mjs
```

Run build and `tsc` sequentially; do not run them in parallel. Run `prompt:validate` when prompt seed or prompt-pack assets change:

```powershell
npm.cmd run prompt:validate
```

## Pitfalls

- `app/globals.css` has late mobile override blocks; search selectors first.
- Duplicate Next dev servers on the same port can produce confusing `404`/stale `_next/static` behavior. If `localhost:3000` looks wrong, check listeners and keep only one dev server.
- Browser automation may need a fresh setup if the in-app browser state is stale; manual Chrome checks may still be useful.
- Local SQLite can change during testing; do not reset it without approval.
- Old provider-hosted image URLs may be expired and unrecoverable.
- Backend reference-image data may be runtime SQLite state; do not assume Git assets alone explain admin previews.

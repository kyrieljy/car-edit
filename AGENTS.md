# AGENTS

Last updated: 2026-06-01 Asia/Shanghai

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

Latest pushed commit:

```text
a3f3b2e Stabilize mobile mode switch position
```

Current `main` already includes prompt lock-down, repo slimming, Config history display fixes, and the recent mobile Chat UI polish.

If this documentation cleanup has not been pushed, the only expected local changes should be root handoff docs.

## Hard Boundaries

- Do not run real provider tests without explicit user approval.
- Do not put auto-recognized vehicle model into `GenerationStandardJson.vehicle.model`; only user-edited model may enter prompt JSON.
- Prompt text is managed from Git seed (`lib/catalog.ts`) and validated by `config/prompt-packs`; SQLite prompt rows are compatibility data only.
- Do not commit runtime DB files, uploads/results, artifacts, or secrets.

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
- SQLite/runtime config/history: `lib/server/db.ts`
- Provider execution: `lib/server/generation-provider.ts`
- Image materialization/proxy/download: `lib/server/image-materializer.ts`, `lib/server/image-assets.ts`, `lib/client/image-download.ts`
- Global/mobile CSS overrides: `app/globals.css`

## Verification

From `D:\car-mod-effect-studio`:

```powershell
git diff --check
npm.cmd run build
npx.cmd tsc --noEmit
node scripts\chat-mode-dry-run-tests.mjs
```

Run build and `tsc` sequentially; do not run them in parallel.

## Pitfalls

- `app/globals.css` has late mobile override blocks; search selectors first.
- Browser automation has recently failed with `windows sandbox failed: spawn setup refresh`; manual mobile browser checks may be needed.
- Local SQLite can change during testing; do not reset it without approval.
- Old provider-hosted image URLs may be expired and unrecoverable.

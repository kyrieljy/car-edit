# AGENTS

Last updated: 2026-05-30 Asia/Shanghai

This file is for the next Codex window.

## Read Order

Read these first:

1. `PROJECT_CONTEXT.md`
2. `TODO.md`
3. `ARCHITECTURE.md`
4. `DECISIONS.md`
5. `AGENTS.md`

Then inspect only the files needed for the newest user request. Do not bulk-read `docs/`, `skills/`, or `prototypes/`. Use `docs/README.md` as the index if a topic reference is needed.

## Current Handoff

The active blocker is test-server 302 image retrieval.

Known state:

- Local code can generate in scenarios that the test server still fails.
- Test server can submit 302 Nano requests and 302 deducts credits.
- The app still may fail to retrieve or materialize the final provider image on the test server.
- A recent failure showed 302 returning a polling URL on `api.302.ai`; code now normalizes compatible 302 polling URLs to the selected endpoint host in commit `a78694a`.
- Recent commits also changed generated/history/download/chat-continuation image handling to materialize provider images locally and avoid durable `file.302` URLs for new records.

Do not run more real provider tests without explicit user approval.

## How To Work

1. Start from the newest user request and current server/browser state.
2. Read `PROJECT_CONTEXT.md` and `TODO.md` before touching code.
3. Use `rg` to find code paths and CSS selectors before editing.
4. Keep edits narrow and explain the exact boundary being changed.
5. Use `apply_patch` for manual edits.
6. Run the relevant verification command.
7. If a real provider call is needed, ask first and explain that credits may be charged.

## Key Files

- Shared controller and desktop UI: `components/car-mod-studio.tsx`
- Mobile app shell/history/profile/config/chat: `components/mobile/mobile-studio-app.tsx`
- Desktop Chat UI: `components/chat-mode.tsx`
- Admin console: `components/admin-console.tsx`
- Workflow designer: `components/workflow-designer.tsx`
- Provider execution: `lib/server/generation-provider.ts`
- Local image materialization: `lib/server/image-materializer.ts`
- Image path/proxy helpers: `lib/server/image-assets.ts`
- Client download helper: `lib/client/image-download.ts`
- SQLite/auth/billing/history/provider config: `lib/server/db.ts`
- Global CSS: `app/globals.css`

## Verification Commands

From:

```powershell
D:\car-mod-effect-studio
```

Docs-only:

```powershell
git diff --check
git status --short
```

Code:

```powershell
npm.cmd run build
npx.cmd tsc --noEmit
```

Chat dry-run when touching Chat logic:

```powershell
node scripts\chat-mode-dry-run-tests.mjs
```

Dev server:

```powershell
npm.cmd run dev -- -H 0.0.0.0 -p 3000
```

## Known Pitfalls

- Real provider tests spend credits.
- 302 may return result URLs on hosts different from the selected endpoint.
- Old `file.302` URLs can expire and may be impossible to recover.
- Browser automation has recently failed with `windows sandbox failed: spawn setup refresh`.
- `app/globals.css` has many late mobile override blocks.
- Some mobile selectors reuse desktop class names.
- Local SQLite changes during testing; do not reset it without approval.
- Do not commit runtime DB files or secrets.

## Documentation Hygiene

Keep root handoff docs compact and current. Remove stale completed work instead of appending a chronology. If a detail belongs to a specific subsystem, put it in the relevant topic doc under `docs/` and link it from `docs/README.md`.

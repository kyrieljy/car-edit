# AGENTS

Last updated: 2026-05-29 Asia/Shanghai

This file is for the next Codex window.

## Read Order

Read only these by default:

1. `PROJECT_CONTEXT.md`
2. `ARCHITECTURE.md`
3. `TODO.md`
4. `DECISIONS.md`
5. `AGENTS.md`

Then inspect only the files needed for the newest user request. Do not bulk-read `docs/`, `skills/`, or `prototypes/`. Use `docs/README.md` as the index if a topic reference is needed.

## Current Handoff

The recent work focused on mobile auth/quota gating, profile, subscription/payment UI, and account messages.

Current notable behavior:

- Mobile not-logged-in and quota-empty states use the green banner under the mode switch.
- Blocked mobile business actions shake the banner and do not call consuming APIs.
- Mobile profile rows open animated subpages, not inline forms.
- Mobile message notification is icon-only with unread badge.
- Account messages are persisted and marked read only when opened.
- Subscription success refreshes billing and message badge through `ACCOUNT_MESSAGES_REFRESH_EVENT`.
- The visible refresh-quota entry has been removed.

## How To Work

1. Start from the newest user request, screenshot, or browser comment.
2. Use `rg` to find components/selectors before editing.
3. Keep the change narrow.
4. Use `apply_patch` for manual edits.
5. Run the relevant verification command.
6. Report exactly what changed and whether verification ran.

## Key Files

- Shared controller and desktop UI: `components/car-mod-studio.tsx`
- Mobile app/profile/banner/messages: `components/mobile/mobile-studio-app.tsx`
- Chat UI/composer/history: `components/chat-mode.tsx`
- Auth UI: `components/auth-modal.tsx`
- Subscription/payment UI: `components/subscribe-modal.tsx`
- Account client: `lib/account-client.ts`
- Account event constant: `lib/account-events.ts`
- Types: `lib/types.ts`
- SQLite/auth/billing/messages: `lib/server/db.ts`
- Global CSS: `app/globals.css`

## Verification Commands

From:

```powershell
C:\Users\54901\Documents\Playground\car-mod-effect-studio
```

TypeScript:

```powershell
npx.cmd tsc --noEmit
```

HTTP smoke:

```powershell
Invoke-WebRequest http://localhost:3000/
```

Chat dry-run when touching Chat logic:

```powershell
node scripts\chat-mode-dry-run-tests.mjs
```

Dev server:

```powershell
npm.cmd run dev -- -H 0.0.0.0 -p 3000
```

Use `npm.cmd run build` only when the dev server is stopped or build verification is explicitly needed.

## Known Pitfalls

- Browser automation has recently failed with `windows sandbox failed: spawn setup refresh`.
- `app/globals.css` has many late mobile override blocks.
- Some mobile selectors reuse desktop class names.
- The parent `Playground` git status is noisy.
- Local SQLite data changes during testing; do not reset it without approval.
- Real provider tests spend credits.

## Documentation Hygiene

Keep these handoff docs compact. If a detail belongs to a specific subsystem, put it in the relevant topic doc under `docs/` and link it from `docs/README.md`; do not append long chronological logs to the root handoff files.

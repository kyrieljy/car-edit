# PROJECT_CONTEXT

Last updated: 2026-05-29 Asia/Shanghai

This is the compact handoff for `car-mod-effect-studio`. New Codex windows should read this file plus `ARCHITECTURE.md`, `TODO.md`, `DECISIONS.md`, and `AGENTS.md`. Do not bulk-read every Markdown file in `docs/`; those are topic references.

## Project

- Path: `C:\Users\54901\Documents\Playground\car-mod-effect-studio`
- User URL: `http://localhost:3000/`
- Admin URL: `http://localhost:3000/admin`
- Demo account: `demo / Demo@1234`
- Admin account: `admin / Admin@1234`
- Stack: Next.js 14 App Router, React 18, TypeScript, Framer Motion, Lucide, local SQLite via experimental `node:sqlite`

The app is a local prototype for AI car modification renders. Current active work is product/UI polish around mobile auth, quota gating, profile, subscription/payment, and account messages. Production account/payment/admin operations are still pending.

## Current Product State

PC user app:

- Config Mode supports upload, recognition, catalog part selection, paint/effects/gradient, stance, generation, save/history, and original/generated/compare views.
- Chat Mode supports vehicle canvas upload, part references, session context, dry run, parser/fallback flow, server progress, and session history.
- Desktop account panel exists for signed-in users with profile/password/phone/subscription/logout actions. The visible “refresh quota” entry has been removed.

Mobile user app:

- Mobile is a separate app-style surface in `components/mobile/mobile-studio-app.tsx`, selected by viewport from `components/car-mod-studio.tsx`.
- Config and Chat share the mobile top bar, mode switch, and access/quota banner.
- The green access banner is mobile-only, full-width under the mode switch, with transition and shake feedback.
- Unauthenticated mobile business actions shake the banner instead of opening login automatically.
- Quota-zero Config generation is blocked before `/api/generations`; quota-zero Chat send/regenerate is blocked before `/api/chat/messages`.
- Profile is a full-screen mobile page with animated subpages for edit profile, bind phone, change password, and messages.
- Message notification uses an icon-only top-right button with red unread badge. Opening a message marks it read; tapping the same open message collapses it. “All read” is available.

Auth/billing prototype:

- Local login/register, mock SMS code, mock WeChat login, profile update, password change, phone change, and session handling exist.
- Local billing has Free/Pro/Max plans, quota status, mock checkout, mock paid callback, and subscription expiration sync.
- Subscription pages have mobile transitions. Opening from home returns home; opening from profile returns profile.
- Paid users cannot downgrade to Free from the current UI. Expiration returns them to Free.
- Real SMS/OAuth/payment/webhooks/refunds/idempotency are not implemented.

Account messages:

- Messages are stored in SQLite table `account_messages`.
- APIs:
  - `GET /api/account/messages`
  - `POST /api/account/messages/[id]/read`
  - `POST /api/account/messages/read-all`
- Message kinds: `system`, `payment`, `subscription`, `quota`.
- Mock payment and subscription change events create messages. Subscription payment success dispatches `ACCOUNT_MESSAGES_REFRESH_EVENT` so the mobile profile badge refreshes immediately.

Generation/provider:

- Config and Chat converge on `GenerationStandardJson`.
- The first vehicle image is always the canvas; part images are references only.
- Real provider tests spend credits and must be explicitly approved by the user.
- Failed real provider calls must not be silently replaced with mock/original/demo images.

## Current Environment Notes

- The in-app Browser automation has recently failed with `windows sandbox failed: spawn setup refresh`. Use it if it works, but do not block on it.
- For frontend verification while Browser is broken, use `npx.cmd tsc --noEmit` and `Invoke-WebRequest http://localhost:3000/` for basic smoke.
- Avoid `npm.cmd run build` while the Next dev server is actively serving; earlier sessions saw `.next` corruption/transient errors during concurrent build/dev use.
- `node:sqlite` experimental warnings are expected.
- `git status` from the parent `Playground` repo is noisy and includes unrelated projects.

## User Preferences

- The user wants to judge UI visually from screenshots/browser state. Do not make broad subjective redesigns.
- Implement the exact requested UI/text/behavior change.
- Keep PC unchanged unless the user asks for PC work or shared logic requires it.
- Do not reset SQLite without explicit approval.
- Do not spend real provider credits without explicit approval.
- Use `apply_patch` for manual edits and do not revert unrelated user changes.

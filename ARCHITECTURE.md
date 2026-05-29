# ARCHITECTURE

Last updated: 2026-05-29 Asia/Shanghai

This document is the current architecture map. It intentionally omits old implementation diaries; use `docs/README.md` to find topic references only when needed.

## App Shape

- `/`: user app. Desktop and mobile are selected by viewport.
- `/admin`: admin console.
- `/api/*`: local prototype APIs for auth, billing, account messages, catalog, chat, generations, garage, proxy image, and recognition.
- Runtime storage is local SQLite plus local project files for uploads/results.

Key files:

```text
app/globals.css
components/car-mod-studio.tsx
components/mobile/mobile-studio-app.tsx
components/chat-mode.tsx
components/auth-modal.tsx
components/subscribe-modal.tsx
lib/account-client.ts
lib/account-events.ts
lib/types.ts
lib/server/auth.ts
lib/server/db.ts
```

## State Ownership

`components/car-mod-studio.tsx` is still the shared controller. It owns catalog/auth/billing/upload/recognition/selection/generation/chat state and renders either the desktop UI or `MobileStudioApp`.

`components/mobile/mobile-studio-app.tsx` owns the mobile app shell and mobile-specific UI behavior: top bar, mode switch, access banner, mobile Config/Chat composition, sheets/drawers, profile pages, and mobile account messages.

`app/globals.css` is large and contains many late mobile overrides. Always `rg` selectors before editing CSS, and prefer targeted changes.

## Mobile Access And Quota

The mobile access banner is rendered near the shared mobile mode bar, outside the mode switch itself.

Banner state comes from local frontend state:

- no `authUser`: login banner
- Config: block when `billing.configRemaining === 0`, unless unlimited
- Chat: block when `billing.chatEnabled === false` or `billing.chatRemainingToday === 0`, unless unlimited

Blocked business actions trigger banner shake only. They do not open subscription/login automatically and do not call consuming APIs.

Server-side 401/402 remains the fallback authority; frontend guards are for immediate UX.

## Auth And Billing

Frontend helper: `lib/account-client.ts`

- profile update
- password change
- phone code and phone change
- billing status refresh helper
- account message list/read/read-all helpers

Server helpers: `lib/server/db.ts`

- users, sessions, verification codes, billing, subscriptions, orders, audit, and account messages
- local password hashing and session logic
- mock payment completion and subscription expiration sync

Important APIs:

```text
GET/PATCH /api/auth/me
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/register
POST /api/auth/send-code
POST /api/auth/password
POST /api/auth/phone
POST /api/auth/wechat/mock
GET /api/billing/plans
GET /api/billing/status
POST /api/billing/checkout
POST /api/billing/mock-paid
GET /api/account/messages
POST /api/account/messages/[id]/read
POST /api/account/messages/read-all
```

## Subscription And Payment UI

`components/subscribe-modal.tsx` handles desktop modal and mobile full-screen subscription UI.

Current behavior:

- Mobile plan tabs are initialized before plan data loads to avoid Free-button flicker.
- Mobile subscription pages slide in/out.
- Payment method modal is constrained on mobile to avoid viewport overflow.
- Mock payment success updates billing and dispatches `ACCOUNT_MESSAGES_REFRESH_EVENT`.
- Free CTA is not a downgrade action for paid users.

## Mobile Profile

`MobileProfilePage` uses section routing:

```ts
type MobileProfileSection = "overview" | "profile" | "password" | "phone" | "messages"
```

Overview rows transition to full-screen subpages rather than inline forms. Subpages provide back/save actions where applicable.

The message page loads persisted account messages. A message is unread until the user opens it. Opening an already open message collapses it.

## Generation Contract

`GenerationStandardJson` remains the central contract for Config and Chat. Prompt assembly and provider requests should consume this contract rather than ad hoc UI state.

Core invariant:

- the first vehicle image is the canvas
- part images are reference-only
- selected parts only
- preserve source vehicle identity, camera angle, lighting, background, unselected parts, wheels, glass, lights, and plate shape unless explicitly selected

Chat-specific strategy lives in `docs/CHAT_MODE_STRATEGY_GUIDE.md`. Only read/update it when touching Chat parser, fallback, prompt, reference allocation, color policy, or dry-run tests.

## Production Gaps

Still prototype/local:

- real SMS
- password reset
- real WeChat OAuth
- real payment provider integration
- webhook verification
- order/refund/cancel state machine
- hardened roles/sessions/rate limits
- production DB migrations
- object storage/CDN
- admin operations dashboards

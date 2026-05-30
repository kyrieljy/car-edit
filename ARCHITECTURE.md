# ARCHITECTURE

Last updated: 2026-05-30 Asia/Shanghai

This is the current architecture map. It is intentionally compact. Use `PROJECT_CONTEXT.md` for the handoff narrative and `TODO.md` for the active queue.

## App Shape

- `/`: user app. Desktop and mobile are selected by viewport in the shared controller.
- `/admin`: internal admin console.
- `/api/*`: local prototype APIs for auth, billing, account messages, catalog, chat, generations, garage, proxy/download image, recognition, and admin data.
- Runtime storage is local SQLite plus local files under project/public upload and result paths.

Key files:

```text
components/car-mod-studio.tsx
components/mobile/mobile-studio-app.tsx
components/chat-mode.tsx
components/admin-console.tsx
components/workflow-designer.tsx
app/globals.css
lib/types.ts
lib/server/db.ts
lib/server/generation-provider.ts
lib/server/image-materializer.ts
lib/server/image-assets.ts
lib/client/image-download.ts
```

## State Ownership

`components/car-mod-studio.tsx` is the shared controller. It owns the main user-facing state for catalog/auth/billing/upload/recognition/selection/generation/chat and renders desktop or `MobileStudioApp`.

`components/mobile/mobile-studio-app.tsx` owns mobile-specific layout and interactions: top bar, mode switch, mobile Config/Chat composition, sheets/drawers, history, profile/auth surfaces, and mobile-only gesture behavior.

`components/chat-mode.tsx` owns desktop Chat UI and much of the shared chat rendering behavior. Mobile Chat consumes the same server session/history concepts through its own shell.

`components/admin-console.tsx` and `components/workflow-designer.tsx` own the internal admin console, provider/workflow configuration, usage/failure/bad-case/user/profile/audit style pages.

`app/globals.css` is large and contains late mobile overrides. Always `rg` selectors before editing CSS and prefer targeted changes.

## Generation And Provider Flow

`GenerationStandardJson` is the central contract for Config and Chat.

Core invariants:

- the first vehicle image is the canvas
- later images are reference-only
- selected parts only
- preserve source vehicle identity, camera angle, lighting, background, unselected parts, wheels, glass, lights, and plate shape unless explicitly selected
- real provider failures must be surfaced honestly
- mock/original/demo images must not be shown as successful provider output

Provider execution lives mainly in `lib/server/generation-provider.ts`.

Current provider defaults are expected from code seeds, with runtime overrides in SQLite:

- 302 Nano Banana 2 for image edit/generation
- 302 GPT Image 2 for image edit/generation
- GPT-5.4 mini style provider for recognition/LLM
- Qwen 3.6 style provider where applicable

Workflows should default to GPT-5.4 mini style recognition/LLM steps and Nano Banana 2 image generation steps.

## Image Storage And Display

The current target architecture is app-origin image display and download.

Provider images should be materialized locally by server code before being used as durable history/result values. External provider URLs such as `file.302.ai` may be temporary fetch sources, but should not be the durable saved output for new records.

Relevant routes and helpers:

```text
lib/server/image-materializer.ts
lib/server/image-assets.ts
lib/client/image-download.ts
app/api/proxy-image/route.ts
app/api/download-image/route.ts
app/uploads/[fileName]/route.ts
app/uploads/chat/[fileName]/route.ts
app/results/[fileName]/route.ts
```

Important behavior:

- uploads and generated results should be readable from the app server
- downloads should use app-origin blob/download helpers instead of navigating to provider URLs
- compare image saving must avoid tainted canvas inputs
- old `file.302` records can only be migrated if the server can still fetch the remote URL

## Runtime Config Boundaries

SQLite is runtime state, not source code.

Use code for:

- seed provider definitions
- default workflows
- default prompt/catalog/billing/guardrail baselines
- UI and API behavior

Use SQLite for:

- provider API keys
- admin-edited provider/workflow/prompt/catalog settings
- users, sessions, orders, quota, account messages
- uploads, generation records, chat sessions, audit/failure logs

Do not commit the local SQLite DB as a substitute for seed code. API keys are encrypted with environment secrets and are not portable unless the same secret is used.

## Auth And Billing

Frontend helper: `lib/account-client.ts`

Server helper: `lib/server/db.ts`

Implemented prototype features:

- local login/register/session
- mock SMS code
- mock WeChat login
- profile/password/phone update
- local billing status and mock checkout
- account messages

Still not production:

- real SMS
- real WeChat OAuth
- password reset
- real payment providers and webhooks
- refunds, idempotency, subscription sync, risk controls, audit hardening

## Admin Console

Admin is an internal console, not a full production operations product yet.

Current areas include:

- data/catalog/provider/workflow/prompt/guardrail/billing/usage
- bad case and failure-oriented views
- user management and user profile style analysis
- audit logs

Still needed before production:

- user/order/quota/generation/failure/provider-cost operations workflows
- safer editing constraints and clearer audit trails
- production DB/storage integration

## Verification Notes

For code changes, run:

```powershell
npm.cmd run build
npx.cmd tsc --noEmit
```

Run them sequentially, not in parallel. `next build` can recreate `.next/types` while `tsc` is reading them.

For real provider tests, ask first because credits may be charged even when the app fails to retrieve the final image.

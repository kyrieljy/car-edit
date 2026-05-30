# PROJECT_CONTEXT

Last updated: 2026-05-30 Asia/Shanghai

This is the current handoff for `car-mod-effect-studio`. New Codex windows should read this file first, then `TODO.md`, `ARCHITECTURE.md`, `DECISIONS.md`, and `AGENTS.md` only if needed. Do not bulk-read every Markdown file in `docs/`; those are topic references.

## Project Snapshot

- Local path: `D:\car-mod-effect-studio`
- GitHub: `https://github.com/kyrieljy/car-edit.git`
- Branch: `main`
- Latest pushed commit at handoff: `a78694a Normalize 302 prediction polling host`
- Local URL: `http://localhost:3000/`
- Local admin URL: `http://localhost:3000/admin`
- Test server URL: `http://47.106.182.116:3000/`
- Test server target path: `/root/car-edit`
- Test server OS: Alibaba Cloud Ubuntu 24.04
- Stack: Next.js 14 App Router, React 18, TypeScript, Framer Motion, Lucide, local SQLite through experimental `node:sqlite`

Default local accounts:

- Demo: `demo / Demo@1234`
- Admin: `admin / Admin@1234`

## Current Product State

The app is an AI car modification render prototype with a desktop web app, a mobile app-style UI, and an internal admin console.

User app:

- Config Mode supports vehicle upload, model recognition, part selection, paint/effect/gradient, stance, generation, result history, original/generated/compare views, and save/export.
- Chat Mode supports vehicle canvas upload, part reference images, session history, latest/original context, dry run, parser/fallback flow, server progress, and regenerate/download.
- Mobile and desktop share the same generation backend but render different UI surfaces.

Admin app:

- Admin console exists at `/admin`.
- It contains catalog/provider/workflow/guardrail/billing/usage/bad-case/user/audit style internal tooling.
- It is still closer to an internal tool than a production operations console. Productized user/order/quota/provider-cost operations remain pending.

Auth and billing:

- Local login/register/session, mock SMS code, mock WeChat login, profile update, password change, phone change, mock checkout, mock paid callback, subscription/quota status, and account messages exist.
- Real SMS, real WeChat OAuth, real payment/webhook/refund/idempotency flows are not implemented.

Storage:

- Runtime data is local SQLite plus local project files under `data/` and mirrored `public/` files for uploads/results.
- This is acceptable for prototype and test server only. Production must move to production DB, object storage, CDN, backup/restore, and proper migrations.

## Runtime Config Boundaries

SQLite is runtime state, not source code.

Stored in SQLite:

- provider API keys and admin-edited provider settings
- user/session/billing/order/account-message data
- uploads/generation/chat histories
- admin edits to catalog/workflows/prompt templates where the app supports runtime editing

Stored in code:

- default seed providers and workflows
- default catalog/prompt/guardrail/billing plan baselines
- UI and API behavior

Important provider defaults currently expected in code:

- Yunwu Nano Banana 2 via the Gemini-compatible `generateContent` endpoint for default image generation/editing
- Yunwu GPT Image 2 Edit is configured as an enabled optional provider on `https://yunwu.ai/v1/images/edits`
- 302 Nano Banana 2 is retained but disabled by default after domestic test-server connectivity failures
- 302 GPT Image 2 is retained but disabled by default after domestic test-server connectivity failures
- GPT-5.4 mini style vision/LLM provider
- Qwen 3.6 style provider
- Default workflows should use GPT-5.4 mini for recognition/LLM steps and Yunwu Nano Banana 2 through `https://yunwu.ai/v1beta/models/gemini-3.1-flash-image-preview:generateContent` for image generation. GPT Image 2 is available as a manual workflow/provider switch.

Do not commit local SQLite to Git. API keys are encrypted with environment secrets, so copying SQLite between machines without the same `CAR_MOD_SECRET` / auth secret can make provider keys undecryptable.

## Test Server Issues Seen

The previous active blocker was 302 result retrieval on the test server. The current deployment direction is to avoid 302 for default image generation and use Yunwu instead.

Observed 302/Nano failures:

- Test server can submit Nano-Banana-2 requests and 302 deducts credits, but the app still fails to return the generated image.
- Earlier errors showed provider endpoint connectivity problems against `api.302ai.cn` / `api.302ai.com`.
- A later failure happened after task submission during result polling:
  `Nano-Banana-2 result polling failed after task submission. result=https://api.302.ai/ws/api/v3/predictions/.../result; fetch failed; ETIMEDOUT ...`
- The reason for that specific error was that 302 returned `urls.get` using `api.302.ai`; the code used it raw and therefore bypassed the configured/domestic host.
- Commit `a78694a` now normalizes returned Nano prediction polling URLs back to the host used by the actual request. This still needs test-server verification.
- Because real provider calls cost credits, do not run more real 302 tests without explicit user approval.

Image persistence/display problems seen on test server:

- Some generated/history images were saved as external `file.302.ai` URLs or displayed through external URLs, causing broken images on Android/PC and sometimes partially working on iOS.
- Commits `e153c7e`, `9a79e34`, and `d6c0209` changed saves/downloads/history/chat continuation to materialize provider images locally and route display/downloads through app-origin APIs.
- Old remote URLs are lazily migrated when history/chat records are read if the server can still fetch the remote image. If an old `file.302` URL has expired or the server cannot reach it, the image cannot be recovered.

Mobile/test-server UI issues previously seen:

- Android and PC mobile emulation had scroll/touch problems and blue tap highlights.
- Mobile history drawer animation became laggy when opening records with content.
- Config history on mobile showed broken images or placeholder titles when old records had missing local images or no recognized model stored.
- Save/download previously jumped to `file.302` or failed on compare canvas with insecure-operation errors.
- These have code fixes in recent commits but should be rechecked on the test server after deployment.

Provider/admin issues seen:

- Provider API keys are not in Git and must be saved in admin on each real environment.
- If `CAR_MOD_SECRET` differs from the one used when saving keys, encrypted provider keys cannot be decrypted.
- PM2 stop/start without correct env can make key decryption appear broken even if SQLite contains the key.
- Workflow/provider capability validation exists; wrong provider type choices should be blocked, but recognition/image/LLM/vector capability combinations still need careful admin QA.

## Deployment Notes

Typical test-server update:

```bash
cd /root/car-edit
git pull
npm run build
pm2 restart car-edit --update-env
```

If the PM2 process name is uncertain:

```bash
pm2 list
pm2 logs car-edit --lines 200
```

If dependencies changed, run `npm ci` before build. Recent image-provider fixes did not add dependencies.

Provider/API-key checks on server:

- Confirm the server is on the latest commit with `git log --oneline -3`.
- Confirm PM2 env contains the expected secret before trusting encrypted provider keys.
- Confirm admin provider config uses the intended 302 host (`api.302ai.cn` or `api.302ai.com`) and not stale `api.302.ai`.
- Do not paste real keys into chat.

## Verification Notes

Do not run `npm.cmd run build` and `npx.cmd tsc --noEmit` in parallel. `tsc` can fail falsely because `next build` recreates `.next/types`.

Use this order:

```powershell
npm.cmd run build
npx.cmd tsc --noEmit
```

Browser automation in this local Codex app has intermittently failed with `windows sandbox failed: spawn setup refresh`. If browser automation is unavailable, use build/type checks and targeted HTTP/API smoke tests, then clearly say visual verification was not completed.

`node:sqlite` experimental warnings during build are expected.

## Working Rules

- Do not reset SQLite without explicit approval.
- Do not spend real provider credits without explicit approval.
- Do not silently show mock/original/demo images as successful provider output.
- Do not commit secrets or local runtime database files.
- Do not revert unrelated user changes.
- Keep UI fixes scoped to the reported surface unless shared logic requires otherwise.

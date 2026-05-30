# TODO

Last updated: 2026-05-30 Asia/Shanghai

This is the active task list for the next Codex window. It has been cleaned up from the older mobile-polish list. Start with `PROJECT_CONTEXT.md` before using this file.

## P0 - Yunwu Default Provider Verification

The current highest-priority issue is switching default image generation away from 302 to Yunwu on local and test-server environments.

1. Confirm deployment state on the test server:
   - `cd /root/car-edit`
   - `git log --oneline -5`
   - Make sure the latest Yunwu-default commit is present.
   - Run `npm run build`, then `pm2 restart car-edit --update-env`.
2. Apply the existing SQLite workflow/provider switch:
   - `npm run provider:yunwu-default`
   - Save the Yunwu API key in `/admin` for `provider_yunwu_image_edit` and, if Nano2 will be tested, `provider_yunwu_nano2_edit`.
3. Check the real runtime logs after one user-approved Yunwu test:
   - `pm2 logs car-edit --lines 200`
   - Confirm the provider is `provider_yunwu_image_edit` for default Image2 tests, or `provider_yunwu_nano2_edit` for explicit Nano2 tests.
   - Confirm the result image is materialized to `/results/...`.
4. If the problem remains, add temporary safe logging around the Yunwu image edit flow:
   - provider id/label
   - selected endpoint host only
   - submit status
   - image output field names found
   - Never log API keys, request images, returned base64, full signed URLs, or user photos.
5. Do not run repeated real provider tests without explicit user approval. Each failed submit may still charge credits.

## P0 - Image Persistence And History

The correct behavior is: provider images are materialized to app-local files, then displayed/downloaded through the app origin.

Check these flows on local and test server:

1. Config Mode generation:
   - generated image displays from app origin, not `file.302.ai`
   - saved result can be downloaded without leaving the app route
   - history thumbnail uses a local/proxied image path
2. Chat Mode generation:
   - uploaded vehicle and part images remain visible after reload
   - generated result remains visible after reload
   - continue/regenerate uses local materialized input images and does not fail with `Input image fetch failed before provider`
3. Compare save:
   - generated compare collage saves/downloads from app origin
   - no `the operation is insecure` canvas error
4. Existing old records:
   - old `file.302` URLs may be unrecoverable if expired or unreachable
   - do not treat expired old records as a new generation bug unless fresh records also fail

Relevant files:

- `lib/server/generation-provider.ts`
- `lib/server/image-materializer.ts`
- `lib/server/image-assets.ts`
- `lib/client/image-download.ts`
- `app/api/proxy-image/route.ts`
- `app/api/download-image/route.ts`
- `app/uploads/[fileName]/route.ts`
- `app/results/[fileName]/route.ts`

## P1 - Mobile Test-Server QA

Re-test these on Android browser, iOS Safari, and PC mobile emulation after P0 is fixed.

1. Android scroll/touch:
   - page can drag/scroll in Config Mode and Chat Mode
   - buttons do not show the browser blue tap background
   - fixed top bar stays clickable and visually stable
2. Chat history drawer:
   - list items show thumbnails when images are available
   - title uses recognized vehicle when available, not only `User uploaded...`
   - opening a record with images is smooth enough on Android
   - selected record restores visible chat content
3. Config result panel:
   - original/generated/compare image area is not blank
   - recognized vehicle label is visible on mobile
   - bottom action controls do not cover important image content
4. Save/download:
   - generated image save works in Config Mode
   - generated image download works in Chat Mode
   - compare collage save works

## P1 - Admin Provider And Workflow QA

1. Provider defaults:
   - 302 Nano Banana 2 exists and is enabled by default
   - 302 GPT Image 2 exists and is enabled by default
   - GPT-5.4 mini style provider exists and is enabled by default
   - Qwen 3.6 style provider exists and is enabled by default
2. Workflow defaults:
   - recognition/LLM steps default to GPT-5.4 mini style provider
   - image generation steps default to Nano Banana 2
3. Capability boundaries:
   - image generation steps accept only image-capable providers
   - vision recognition steps accept only vision-capable providers
   - LLM steps accept only text/LLM-capable providers
   - vector steps accept only embedding/vector-capable providers
4. Runtime secrets:
   - API keys must be saved per environment in admin
   - SQLite from one machine should not be copied as a key source unless the same secret is used
   - if provider key decrypt fails, check PM2 env before editing code

## P2 - Product Gaps Before Public Release

These are not needed to unblock the current 302 bug, but remain required before a serious public launch.

1. License plate:
   - plate mask/cover
   - plate preservation
   - other-country plate styles
2. Production auth:
   - real SMS provider
   - real WeChat OAuth
   - password reset
   - account bind/unbind
   - session/rate-limit/risk controls
   - security audit trail
3. Production billing:
   - WeChat Pay, Alipay, Stripe
   - order state machine
   - webhook verification
   - idempotency
   - refunds
   - subscription/quota sync
   - quota deduction audit
4. Production storage:
   - production DB
   - object storage
   - CDN
   - backup/restore
   - migrations and seed separation
5. Operations console:
   - user operations
   - orders/payments
   - quota adjustments and audit
   - generation/failure records
   - provider cost statistics
   - bad-case review workflow

## Verification Commands

For docs-only changes:

```powershell
git diff --check
git status --short
```

For code changes, run in this order:

```powershell
npm.cmd run build
npx.cmd tsc --noEmit
```

Do not run build and `tsc` in parallel because `.next/types` can race.

For chat logic changes:

```powershell
node scripts\chat-mode-dry-run-tests.mjs
```

For real provider tests, ask first because they spend credits.

## Do Not Do

- Do not reset SQLite without explicit approval.
- Do not commit `data/car_mod_effect.sqlite` or any secret-bearing runtime DB.
- Do not spend real provider credits without explicit approval.
- Do not log API keys, base64 images, user photos, or full signed provider URLs.
- Do not silently show mock/original/demo images as successful provider output.
- Do not reintroduce raw external provider image URLs as the normal saved output.
- Do not revert unrelated user changes.

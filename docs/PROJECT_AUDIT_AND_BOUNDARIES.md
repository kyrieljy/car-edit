# Project Audit And Boundaries

Last updated: 2026-05-30 Asia/Shanghai

## Current Boundary

The repository should treat project configuration as reproducible assets and runtime data as environment-specific state.

Project configuration:

- Prompt presets and prompt templates
- Default provider definitions without API keys
- Workflow definitions and provider assignment
- Catalog categories, brands, part assets, reference metadata, guardrail config, membership plans

Runtime data:

- Users, sessions, identities, verification codes
- Provider API keys and encrypted key material
- Vehicle uploads, generated results, garage items, usage ledger
- Chat sessions, messages, attachments
- Orders, subscriptions, account messages, audit logs, bad cases

## SQLite Policy

Short term, the app can keep using one SQLite file, but deployment must not copy the whole local DB as source of truth. Use project config export/apply scripts to migrate project configuration, then set provider keys per environment.

Recommended future split:

- `config.sqlite` or code-backed migration for project config
- `runtime.sqlite` or production DB for users, chat, billing, generation records, and image references
- Object storage/CDN for durable images in production

## Image Policy

Durable records must use app-local paths:

- `/results/...` for generated images
- `/uploads/...` for vehicle uploads
- `/uploads/chat/...` for chat attachments
- `/uploads/parts/...` for admin-uploaded catalog assets
- `/assets/...` for committed static assets

Remote provider URLs are temporary fetch sources only. Fresh records should not persist raw `file.302`, `fal.media`, Yunwu, or other provider URLs.

## Provider Policy

302 remains supported but is no longer the default image generation route for domestic test-server deployment. Yunwu is the default image edit provider for config/chat workflows because the Alibaba Cloud test server cannot reliably reach the 302 hosts.

For system providers from code seed, non-secret fields such as label, base URL, model name, and capabilities are code-owned. Environment-owned fields are enabled/active state and API keys.

302 Nano-Banana-2 follows the async image-edit spec at `https://doc.302.ai/420136733e0` by default on the Alibaba Cloud test server: `enable_sync_mode=false`, `enable_base64_output=false`, and the initial POST returns a task id plus `urls.get`. Polling tries the configured/domestic host first and the documented `api.302.ai` URL second. Set `NANO_BANANA_302_SYNC_MODE=1` only for a controlled local/provider test.

The Yunwu default is Nano Banana 2 through the Gemini-compatible endpoint:

- `provider_yunwu_nano2_edit`
- `https://yunwu.ai/v1beta/models/gemini-3.1-flash-image-preview:generateContent`
- `gemini-3.1-flash-image-preview`
- lowest-cost defaults: one generated image per call, inline Gemini image payload, `generationConfig.imageConfig.imageSize=512`, no automatic retry/fallback for charge-on-submit failures

The Yunwu Image2 provider is also configured:

- `provider_yunwu_image_edit`
- `https://yunwu.ai/v1/images/edits`
- `gpt-image-2`
- lowest-cost defaults: `quality=low`, `size=1024x1024`, `n=1`, `output_format=jpeg`, `output_compression=80`

Run `npm run provider:yunwu-default` on an existing environment after pulling code to switch the SQLite workflow/provider rows to Yunwu Nano2 while preserving/copying a stored Yunwu API key between the two Yunwu provider rows when possible. The Gemini-compatible Nano2 endpoint uses inline image input, so it can be tested locally after explicit approval; real tests still spend provider credits.

## Audit Command

Run:

```powershell
npm.cmd run audit:project
```

The audit prints table boundary counts, active prompt/provider/workflow state, image URL buckets, and cleanup candidates without exposing API keys.

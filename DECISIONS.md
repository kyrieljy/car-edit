# DECISIONS

Last updated: 2026-05-30 Asia/Shanghai

Only current decisions are kept here. Historical implementation notes and completed mobile-auth details have been removed.

## 1. Runtime SQLite Is Not Source Code

SQLite holds environment-specific runtime state and admin overrides. Default providers, workflows, catalog/prompt/billing baselines, and UI/API behavior belong in code.

Do not commit local SQLite as a fix for missing defaults. Do not assume provider keys can be moved with SQLite unless the environment secret is identical.

## 2. Provider Keys Are Environment Secrets

API keys must be saved in each real environment through admin or a controlled secret workflow. If decryption fails, check `CAR_MOD_SECRET` / PM2 env before changing provider code.

## 3. Real Provider Failures Must Stay Visible

Do not silently replace a failed real generation with mock/original/demo output. This is especially important while debugging 302 because failed submits can still charge credits.

## 4. Provider Images Must Be Materialized Locally

New durable generation/history/chat records should use app-local image paths or app-origin proxied/downloadable images, not raw `file.302` or other provider-hosted URLs.

Old external URLs may remain in historical records and can only be migrated if the server can still fetch them.

## 5. 302 Polling Must Respect The Configured Host

302 may return prediction/result URLs on a different host such as `api.302.ai`. The app should normalize compatible 302 polling URLs to the host used by the selected provider endpoint so the test server does not accidentally route through a blocked host.

## 6. Real Provider Tests Require User Approval

Do not run live Nano/GPT Image/provider smoke tests without explicit approval. A failed result retrieval can still deduct credits.

## 7. Desktop And Mobile Are Separate UI Surfaces

Desktop and mobile share backend/state contracts but have separate visual surfaces. Fix the reported surface without broad redesign unless shared logic is the cause.

## 8. Generation Uses Standard JSON

Config and Chat must converge on `GenerationStandardJson`. The first image is the vehicle canvas; later images are references. Prompt/provider code should preserve unselected vehicle details.

## 9. Workflow Provider Selection Is Capability-Based

Workflow steps must validate provider capability. Image steps need image-capable providers, recognition steps need vision-capable providers, LLM steps need text/LLM providers, and vector steps need embedding/vector providers.

## 10. Admin Is Still Internal Tooling

The admin console can support testing and operations, but it is not yet a production-grade operations platform. Production user/order/quota/provider-cost workflows and audit hardening remain future work.

## 11. Verification Is Sequential

Run `npm.cmd run build` before `npx.cmd tsc --noEmit`. Do not run them in parallel because `.next/types` can race.

## 12. Avoid Unsafe Logging

Temporary provider diagnostics may log endpoint hosts, response status, safe IDs, and response shape. They must not log API keys, base64 images, user photos, or full signed provider URLs.

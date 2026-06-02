# DECISIONS

Last updated: 2026-06-01 Asia/Shanghai

Only current project decisions are kept here.

## 1. Runtime SQLite Is Not Source Code

SQLite holds environment-specific runtime state and admin overrides. Default providers, workflows, catalog/prompt/billing baselines, and UI/API behavior belong in code.

## 2. Prompt Authority Is Git Seed

Runtime prompt text comes from `lib/catalog.ts` seed. `config/prompt-packs` is validation evidence. Admin prompt pages and prompt APIs are read-only for prompt bodies; config export/apply excludes prompt bodies. SQLite prompt rows are compatibility data only.

## 3. Vehicle Model Recognition Is Display Metadata

Auto-recognized vehicle model must not enter `GenerationStandardJson.vehicle.model` by default. Only a user-edited model should enter prompt JSON. UI/history display uses `displayVehicleModel` / `generation_jobs.display_vehicle_model`.

## 4. Real Provider Failures Must Stay Visible

Do not silently replace a failed real generation with mock/original/demo output. Failed provider submits may still charge credits.

## 5. Provider Images Must Be Materialized Locally

New durable generation/history/chat records should use app-local paths or app-origin proxy/download helpers, not raw provider-hosted URLs. Old external URLs may remain and can only be migrated if still fetchable.

## 6. Provider Keys Are Environment Secrets

Keys must be saved per environment through admin or controlled secrets. If decryption fails, check environment secrets before changing provider code.

## 7. Real Provider Tests Require User Approval

Do not run live provider smoke tests without explicit approval and a credit-usage warning.

## 8. Desktop And Mobile Are Separate UI Surfaces

They share backend/state contracts, but visual behavior can diverge. Fix the reported surface without broad redesign unless shared logic is the cause.

## 9. Workflow Provider Selection Is Capability-Based

Image steps need image-capable providers, recognition steps need vision-capable providers, LLM steps need text/LLM providers, and vector steps need embedding/vector providers.

## 10. Admin Is Internal Tooling

The admin console supports testing and operations, but it is not a production-grade operations platform yet.

## 11. Verification Is Sequential

Run `npm.cmd run build` before `npx.cmd tsc --noEmit`. Do not run them in parallel because `.next/types` can race.

## 12. Avoid Unsafe Logging

Provider diagnostics may log endpoint hosts, response status, safe IDs, and response shape. They must not log API keys, base64 images, user photos, or full signed provider URLs.

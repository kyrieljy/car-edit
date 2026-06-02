# ARCHITECTURE

Last updated: 2026-06-01 Asia/Shanghai

Compact architecture map. Use `PROJECT_CONTEXT.md` for current state and `TODO.md` for active work.

## App Shape

- `/`: user app. `components/car-mod-studio.tsx` owns shared state and chooses desktop or mobile UI by viewport.
- `/admin`: internal admin console.
- `/api/*`: prototype APIs for auth, billing, catalog, chat, generations, garage/history, image proxy/download, recognition, and admin data.
- Runtime storage: local SQLite plus files served from app upload/result paths.

Core files:

```text
components/car-mod-studio.tsx
components/mobile/mobile-studio-app.tsx
components/chat-mode.tsx
components/admin-console.tsx
components/workflow-designer.tsx
app/globals.css
lib/types.ts
lib/server/db.ts
lib/server/generation-engine.ts
lib/server/generation-provider.ts
lib/server/image-materializer.ts
lib/server/image-assets.ts
lib/client/image-download.ts
```

## State And UI Ownership

- `car-mod-studio.tsx`: shared user-facing state for catalog, auth, billing, upload, recognition, selection, generation, and chat.
- `mobile-studio-app.tsx`: mobile shell, top bar, mode switch, Config/Chat composition, profile/auth/subscription surfaces, and mobile drawers.
- `chat-mode.tsx`: Chat session/history/message/composer UI. Desktop sidebar and mobile Chat drawer share logic, but mobile-specific rendering should be guarded by `mobileVariant` / drawer state.
- `admin-console.tsx` and `workflow-designer.tsx`: internal admin/provider/workflow/catalog/billing/usage/failure tooling.
- `app/globals.css`: large global stylesheet with late mobile overrides; inspect selectors before editing.

## Generation And Prompt Flow

`GenerationStandardJson` is the shared Config/Chat generation contract.

Invariants:

- First image is the vehicle canvas; later images are references.
- Selected parts only; preserve unselected vehicle details.
- Preserve source vehicle identity, camera angle, lighting, background, wheels, glass, lights, plate shape, and unselected parts unless explicitly changed.
- Auto-recognized vehicle model is display metadata only unless the user edits it.
- Real provider failures are surfaced honestly.

Prompt text:

- Runtime active prompt comes from `lib/catalog.ts` seed.
- `config/prompt-packs` validates seed content.
- SQLite prompt tables remain for compatibility but are not runtime authority.

Provider execution lives mainly in `lib/server/generation-engine.ts` and `lib/server/generation-provider.ts`. Provider/workflow rows may be overridden in SQLite, but defaults belong in code.

## Image Storage

New durable outputs should be app-local/proxied paths:

```text
/uploads/...
/uploads/chat/...
/results/...
```

Relevant helpers/routes:

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

Raw provider URLs may be temporary fetch sources, but should not be saved as new durable history/chat output.

## Runtime Config

Code owns defaults and behavior. SQLite owns environment-specific runtime state, including provider keys, users, sessions, billing, uploads, generations, chat records, and admin overrides.

Do not commit SQLite as a substitute for seed code. Provider keys are encrypted with environment secrets and may not decrypt in another environment.

## Verification Notes

For code changes:

```powershell
npm.cmd run build
npx.cmd tsc --noEmit
```

Run them sequentially because `next build` can recreate `.next/types` while `tsc` reads them. Real provider tests require explicit approval.

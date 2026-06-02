# TODO

Last updated: 2026-06-01 Asia/Shanghai

Short active queue. Start with `PROJECT_CONTEXT.md`; do not bulk-read `docs/` unless a linked topic is needed.

## P0 - Deploy Latest Main To Test Server

Latest pushed commit:

```text
a3f3b2e Stabilize mobile mode switch position
```

Deploy:

```bash
cd /root/car-edit
git pull
npm run build
pm2 restart car-edit --update-env
```

Expected smoke checks after deploy:

- Mobile Chat mode switch does not shift when switching Config/Chat.
- Mobile Chat page has no white edge lines.
- Mobile Chat drawer stays above the top bar while closing.
- Mobile Chat drawer has no search box and history items are shifted up.
- Mobile Chat composer remains one line when empty; placeholder does not wrap.
- `+` upload menu is not covered by validation notices.
- Banner text has no extra glow/highlight block behind it.
- User avatar is human icon; assistant avatar is car icon.

## P0 - Guard Prompt And History Invariants

For any change touching prompt/history:

- Runtime prompt source remains Git seed in `lib/catalog.ts`.
- `config/prompt-packs` is validation evidence only.
- Admin/config migration must not create, update, export, import, or apply prompt bodies.
- Auto-recognized vehicle model must not enter `GenerationStandardJson.vehicle.model`.
- History titles should use `displayVehicleModel` when available and never show internal ids such as `gen_...`.

Useful checks:

```powershell
npm.cmd run prompt:validate
npm.cmd run build
npx.cmd tsc --noEmit
```

Run `prompt:validate` only when prompt assets/templates are touched.

## P1 - Image And Provider QA

Use existing records where possible:

- Generated images display from app-local/proxied paths.
- Chat upload/result/continue flows preserve local image paths.
- Download/export uses app-origin helpers and does not navigate to provider URLs.
- Old raw provider URLs may be expired; do not treat unrecoverable historical records as current bugs.

Real provider tests require explicit approval. Before a paid test, confirm latest commit is deployed, provider key exists, and `APP_URL` / `PROVIDER_PUBLIC_BASE_URL` point to the test server.

## P2 - Production Gaps

Still prototype-only:

- real SMS and WeChat OAuth
- real payment/webhook/refund/idempotency
- production DB/object storage/CDN/backups
- production operations console for users/orders/quota/provider cost
- stronger admin audit and runtime-config safety

## Verification Commands

Docs only:

```powershell
git diff --check
git status --short
```

Code:

```powershell
npm.cmd run build
npx.cmd tsc --noEmit
```

Chat logic:

```powershell
node scripts\chat-mode-dry-run-tests.mjs
```

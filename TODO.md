# TODO

Last updated: 2026-05-29 Asia/Shanghai

This is the active task list only. Old completed work has been removed from this handoff.

## Next Likely Work

1. Continue user-directed mobile UI polish from screenshots/browser state.
2. Verify recent flows visually when the user asks:
   - mobile access/quota banner
   - mobile auth page and form transitions
   - mobile profile subpages
   - message badge/read/collapse/all-read behavior
   - subscription entry/return animation
   - mobile payment method modal overflow
3. Keep fixing only the reported surface. Do not broaden the redesign.

## Product Work Still Pending

User/account:

- production SMS provider
- password reset
- real WeChat OAuth
- account binding/unbinding rules
- role/session/rate-limit hardening
- account audit review UI

Payment/billing:

- real WeChat Pay/Alipay/Stripe integration
- webhook verification
- idempotent order state machine
- payment failure/cancel/refund handling
- invoice/billing history
- explicit upgrade/downgrade/renewal rules
- quota reconciliation jobs

Operations/admin:

- user management view
- order/payment view
- quota adjustment/history view
- generation records view
- failure records view
- provider cost/statistics view
- account message/admin station-letter tooling

Car feature work:

- license plate local edit/mask feature
- additional local detail tools under mobile Details
- prompt/result QA for selected-only edits

Platform/storage:

- production database and migrations
- object storage/CDN for uploads/results/assets
- backup/restore
- dev/prod seed separation
- WeChat Mini Program, Android, iOS only after the web product stabilizes

## Verification

For normal code/UI changes:

```powershell
npx.cmd tsc --noEmit
```

Use a simple HTTP smoke if Browser automation is unavailable:

```powershell
Invoke-WebRequest http://localhost:3000/
```

Run `npm.cmd run build` only when the dev server is stopped or when build verification is explicitly needed.

For Chat logic changes:

```powershell
node scripts\chat-mode-dry-run-tests.mjs
```

For real provider tests: ask first, because they spend credits.

## Do Not Do

- Do not reset SQLite without explicit approval.
- Do not spend real provider credits without explicit approval.
- Do not silently show mock/original/demo images as successful provider output.
- Do not reintroduce free-canvas/React Flow workflow editing.
- Do not expose provider keys or internal provider IDs in normal user UI.
- Do not revert unrelated user changes.

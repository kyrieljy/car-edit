# Chat Mode Dry Run Test Report

Last condensed: 2026-05-29 Asia/Shanghai

This used to contain a long per-case table. It was condensed to reduce handoff context. Regenerate a fresh report from the script when Chat behavior changes.

## Latest Known Result

- Last recorded run: 2026-05-22
- Command shape: `node scripts\chat-mode-dry-run-tests.mjs`
- Scope: upload validation, basic generation, missing references, catalog exact match, part grouping, multi-turn follow-up, context canvas choice, relaxed guardrail, LLM fallback fixtures, stance presets, carbon color-policy follow-up.
- Result recorded at the time: `76/76 passed`

## When To Run

Run the dry-run tests when touching:

- `app/api/chat/messages/route.ts`
- `components/chat-mode.tsx`
- Chat parser/fallback logic in `lib/generation-core.ts`
- part reference allocation
- carbon color-policy behavior
- stance/paint parsing

## Command

```powershell
node scripts\chat-mode-dry-run-tests.mjs
```

Also run:

```powershell
npx.cmd tsc --noEmit
```

## Maintenance Rule

Do not append large result tables here. Keep only the latest summary and add or update actual test cases in the script.

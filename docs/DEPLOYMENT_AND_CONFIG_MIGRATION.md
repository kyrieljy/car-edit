# Deployment And Config Migration

Last updated: 2026-05-30 Asia/Shanghai

## Local Export

Generate a project-config export from the local DB:

```powershell
npm.cmd run config:sync-seeds
npm.cmd run config:export -- --out artifacts/project-config.local.json
npm.cmd run config:validate -- --file artifacts/project-config.local.json
```

The export includes prompt, workflow, provider non-secret fields, catalog metadata, guardrail config, and membership plans. It excludes API keys, key ciphers, users, chats, generation history, orders, and runtime images.

Exports are built from the app's merged AdminSummary view, not raw SQLite tables. This keeps code seed defaults and runtime-safe overrides aligned with what the app actually uses.

## Test Server Apply

On the test server after `git pull` and dependency install:

```bash
node scripts/sync-code-seeds.mjs
node scripts/apply-project-config.mjs --file artifacts/project-config.local.json
node scripts/apply-project-config.mjs --file artifacts/project-config.local.json --apply
npm run build
pm2 restart car-edit --update-env
```

The first command is a dry-run. The second command upserts project config only and does not touch provider key columns.

## Compare Two Environments

Export both environments and compare:

```powershell
npm.cmd run config:export -- --out artifacts/project-config.local.json
npm.cmd run config:validate -- --file artifacts/project-config.local.json --compare artifacts/project-config.test.json
```

Any difference means the deployed project config is not the same as the local project config.

If validation warns about `api.302.ai`, open Admin or apply the current code seed before exporting. Domestic test servers should use the configured/domestic 302 host, such as `api.302ai.cn`, unless a live test proves otherwise.

## Provider Keys

Provider keys are environment secrets. Configure them in Admin or through a controlled secret process after migration. Do not commit SQLite, `.env`, provider key exports, or runtime image folders.

Connectivity checks are dry-run by default:

```powershell
node scripts/check-provider-connectivity.mjs
```

Only run a live check after explicit approval because it can spend credits:

```powershell
node scripts/check-provider-connectivity.mjs --live
```

## Deployment Checklist

1. Confirm Git commit on server matches the intended local commit.
2. Apply project config export dry-run, then apply.
3. Confirm provider keys exist in the server environment.
4. Build sequentially, then restart PM2 with updated env.
5. Run dry-run UI/API checks first.
6. Run one real provider smoke test only after approval.
7. Confirm fresh DB records use `/results` or `/uploads`, not raw provider URLs.

## Rollback

Rollback code with Git, then re-apply the matching project-config export for that code version. Runtime DB rows and local image files are environment data; do not overwrite them with a local development DB unless a separate backup/restore plan has been approved.

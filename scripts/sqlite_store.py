from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
import sys
import time
from pathlib import Path


ROOT = Path.cwd()
DB_PATH = ROOT / "data" / "car_mod_effect.sqlite"
DEMO_USER_ID = "demo-user"

CATEGORY_OVERRIDES = {
    "wheels": ("Wheels", "Forged wheels, colors, offsets and fitment."),
    "calipers": ("Brake calipers", "Caliper colors and performance brake styles."),
    "rear-wing": ("Rear wing", "Ducktail, GT wing and carbon aero pieces."),
    "front-bumper": ("Front aero", "Front lips, splitters and bumper profiles."),
    "side-skirts": ("Side skirts", "Carbon side extensions and lower body lines."),
    "diffuser": ("Diffuser", "Rear diffusers, lower splitters and aero fins."),
    "exhaust": ("Exhaust", "Tip finishes and rear exhaust layouts."),
    "hood": ("Hood", "Vented hoods and carbon hood panels."),
    "lights": ("Light tint", "Smoked light film and lamp treatment."),
    "wrap": ("Wrap", "Body finish, matte, gloss and metallic paint."),
    "mirrors": ("Mirrors", "Mirror caps and carbon trim."),
    "grille": ("Grille", "Kidney grille, mesh and front intake detail."),
}

PROVIDER_OVERRIDES = {
    "mock": ("Mock Local Preview", "mock-render-v1"),
    "openai": ("GPT Image", "gpt-image-2.0"),
    "nano": ("Nano Banana", "nano-banana/edit"),
}


def main() -> None:
    request = json.loads(sys.stdin.read() or "{}")
    op = request.get("op")
    payload = request.get("payload") or {}
    seeds = payload.get("seeds") or {}
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=8)
    conn.row_factory = sqlite3.Row
    init_schema(conn)
    seed(conn, seeds)

    if op == "catalog":
        result = catalog(conn)
    elif op == "create_upload":
        result = create_upload(conn, payload)
    elif op == "create_generation":
        result = create_generation(conn, payload)
    elif op == "generation":
        result = generation(conn, payload["id"])
    elif op == "save_garage":
        result = save_garage(conn, payload["generationId"])
    elif op == "admin_summary":
        result = admin_summary(conn)
    elif op == "create_asset":
        result = create_asset(conn, payload)
    elif op == "update_asset":
        result = update_asset(conn, payload["id"], payload.get("patch") or {})
    elif op == "update_provider":
        result = update_provider(conn, payload)
    elif op == "create_prompt":
        result = create_prompt(conn, payload)
    else:
        raise ValueError(f"Unknown op: {op}")

    conn.commit()
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          role TEXT NOT NULL,
          plan TEXT NOT NULL DEFAULT 'prototype',
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS asset_categories (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          description TEXT NOT NULL,
          sort_order INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS part_assets (
          id TEXT PRIMARY KEY,
          category_id TEXT NOT NULL,
          brand TEXT NOT NULL,
          model TEXT NOT NULL,
          variant TEXT NOT NULL,
          keywords TEXT NOT NULL DEFAULT '',
          color TEXT NOT NULL,
          finish TEXT NOT NULL,
          image_url TEXT NOT NULL,
          image_crop TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          prompt_hint TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS prompt_presets (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          version TEXT NOT NULL,
          body TEXT NOT NULL,
          negative_prompt TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS provider_configs (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          model_name TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 0,
          api_key_cipher TEXT,
          api_key_masked TEXT,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS vehicle_uploads (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          url TEXT NOT NULL,
          mime TEXT NOT NULL,
          size INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS generation_jobs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          vehicle_upload_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          paint_id TEXT NOT NULL,
          stance INTEGER NOT NULL,
          selections_json TEXT NOT NULL,
          prompt_summary TEXT NOT NULL,
          prompt_hidden TEXT NOT NULL,
          status TEXT NOT NULL,
          result_image_url TEXT NOT NULL,
          usage_units INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS usage_ledger (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          generation_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          usage_units INTEGER NOT NULL,
          cost_cents INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS garage_items (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          generation_id TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        """
    )
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(part_assets)").fetchall()}
    if "keywords" not in columns:
        conn.execute("ALTER TABLE part_assets ADD COLUMN keywords TEXT NOT NULL DEFAULT ''")


def seed(conn: sqlite3.Connection, seeds: dict) -> None:
    now = now_ms()
    conn.execute(
        "INSERT OR IGNORE INTO users (id, name, email, role, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (DEMO_USER_ID, "Demo User", "demo@local", "user", "prototype", now),
    )
    conn.execute(
        "INSERT OR IGNORE INTO users (id, name, email, role, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("admin", "Admin", "admin@local", "admin", "internal", now),
    )

    for item in seeds.get("categories", []):
        label, description = CATEGORY_OVERRIDES.get(item["id"], (item["label"], item["description"]))
        conn.execute(
            """
            INSERT INTO asset_categories (id, label, description, sort_order) VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              label = excluded.label,
              description = excluded.description,
              sort_order = excluded.sort_order
            """,
            (clean(item["id"]), label, description, item["sortOrder"]),
        )

    for item in seeds.get("assets", []):
        conn.execute(
            """
            INSERT OR IGNORE INTO part_assets
            (id, category_id, brand, model, variant, keywords, color, finish, image_url, image_crop, active, prompt_hint, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                clean(item["id"]),
                clean(item["categoryId"]),
                clean(item["brand"]),
                clean(item["model"]),
                clean(item["variant"]),
                default_asset_keywords(item),
                clean(item["color"]),
                clean(item["finish"]),
                clean(item["imageUrl"]),
                clean(item.get("imageCrop", "")),
                1 if item.get("active", True) else 0,
                clean(item["promptHint"]),
                now,
            ),
        )

    prompt = seeds.get("prompt")
    if prompt:
        conn.execute(
            """
            INSERT OR IGNORE INTO prompt_presets
            (id, title, version, body, negative_prompt, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                clean(prompt["id"]),
                clean(prompt["title"]),
                clean(prompt["version"]),
                clean(prompt["body"]),
                clean(prompt["negativePrompt"]),
                1,
                now,
            ),
        )

    for item in seeds.get("providers", []):
        label, model_name = PROVIDER_OVERRIDES.get(item["id"], (item["label"], item["modelName"]))
        conn.execute(
            """
            INSERT INTO provider_configs
            (id, label, model_name, enabled, api_key_cipher, api_key_masked, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              label = CASE WHEN provider_configs.label = '' THEN excluded.label ELSE provider_configs.label END,
              model_name = CASE WHEN provider_configs.model_name = '' THEN excluded.model_name ELSE provider_configs.model_name END
            """,
            (clean(item["id"]), label, model_name, 1 if item["enabled"] else 0, "", "", now),
        )


def catalog(conn: sqlite3.Connection) -> dict:
    return {
        "categories": categories(conn),
        "assets": [asset for asset in assets(conn) if asset["active"]],
        "providers": providers(conn),
        "promptPreset": active_prompt(conn),
    }


def create_upload(conn: sqlite3.Connection, payload: dict) -> dict:
    upload_id = f"upload_{secrets.token_hex(6)}"
    conn.execute(
        "INSERT INTO vehicle_uploads (id, user_id, file_name, url, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (upload_id, DEMO_USER_ID, payload["fileName"], payload["url"], payload["mime"], int(payload["size"]), now_ms()),
    )
    return {"id": upload_id, "url": payload["url"]}


def create_generation(conn: sqlite3.Connection, payload: dict) -> dict:
    generation_id = f"gen_{secrets.token_hex(6)}"
    provider = payload["provider"]
    units = 1 if provider == "mock" else 4
    cost_cents = 0 if provider == "mock" else 90
    now = now_ms()
    conn.execute(
        """
        INSERT INTO generation_jobs
        (id, user_id, vehicle_upload_id, provider, paint_id, stance, selections_json, prompt_summary, prompt_hidden, status, result_image_url, usage_units, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            generation_id,
            DEMO_USER_ID,
            payload["vehicleUploadId"],
            provider,
            payload["paintId"],
            int(payload["stance"]),
            json.dumps(payload.get("selections") or {}, ensure_ascii=False),
            payload["promptSummary"],
            payload["promptHidden"],
            "succeeded",
            payload["sourceImageUrl"],
            units,
            now,
        ),
    )
    conn.execute(
        "INSERT INTO usage_ledger (id, user_id, generation_id, provider, usage_units, cost_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (f"usage_{secrets.token_hex(6)}", DEMO_USER_ID, generation_id, provider, units, cost_cents, now),
    )
    return generation(conn, generation_id)


def generation(conn: sqlite3.Connection, generation_id: str) -> dict:
    row = conn.execute(
        """
        SELECT generation_jobs.*, vehicle_uploads.url AS source_image_url
        FROM generation_jobs
        JOIN vehicle_uploads ON vehicle_uploads.id = generation_jobs.vehicle_upload_id
        WHERE generation_jobs.id = ?
        """,
        (generation_id,),
    ).fetchone()
    if not row:
        raise KeyError(generation_id)
    return map_generation(row)


def save_garage(conn: sqlite3.Connection, generation_id: str) -> dict:
    conn.execute(
        "INSERT INTO garage_items (id, user_id, generation_id, created_at) VALUES (?, ?, ?, ?)",
        (f"garage_{secrets.token_hex(6)}", DEMO_USER_ID, generation_id, now_ms()),
    )
    row = conn.execute("SELECT COUNT(*) AS count FROM garage_items WHERE user_id = ?", (DEMO_USER_ID,)).fetchone()
    return {"garageCount": int(row["count"])}


def admin_summary(conn: sqlite3.Connection) -> dict:
    usage_rows = conn.execute("SELECT * FROM usage_ledger ORDER BY created_at DESC LIMIT 50").fetchall()
    generation_rows = conn.execute(
        """
        SELECT generation_jobs.*, vehicle_uploads.url AS source_image_url
        FROM generation_jobs
        JOIN vehicle_uploads ON vehicle_uploads.id = generation_jobs.vehicle_upload_id
        ORDER BY generation_jobs.created_at DESC LIMIT 30
        """
    ).fetchall()
    user_rows = conn.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
    return {
        "stats": {
            "users": scalar(conn, "SELECT COUNT(*) FROM users"),
            "activeAssets": scalar(conn, "SELECT COUNT(*) FROM part_assets WHERE active = 1"),
            "generations": scalar(conn, "SELECT COUNT(*) FROM generation_jobs"),
            "usageUnits": scalar(conn, "SELECT COALESCE(SUM(usage_units), 0) FROM usage_ledger"),
        },
        "categories": categories(conn),
        "assets": assets(conn),
        "providers": providers(conn),
        "prompts": prompts(conn),
        "users": [
            {
                "id": row["id"],
                "name": row["name"],
                "email": row["email"],
                "role": row["role"],
                "plan": row["plan"],
                "createdAt": int(row["created_at"]),
            }
            for row in user_rows
        ],
        "generations": [map_generation(row) for row in generation_rows],
        "usage": [
            {
                "id": row["id"],
                "userId": row["user_id"],
                "generationId": row["generation_id"],
                "provider": row["provider"],
                "usageUnits": int(row["usage_units"]),
                "costCents": int(row["cost_cents"]),
                "createdAt": int(row["created_at"]),
            }
            for row in usage_rows
        ],
    }


def create_asset(conn: sqlite3.Connection, payload: dict) -> dict:
    keywords = clean(payload.get("keywords") or default_asset_keywords(payload))
    if not keywords.strip():
        raise ValueError("Asset keywords are required")
    conn.execute(
        """
        INSERT INTO part_assets
        (id, category_id, brand, model, variant, keywords, color, finish, image_url, image_crop, active, prompt_hint, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload["id"],
            payload["categoryId"],
            payload["brand"],
            payload["model"],
            payload["variant"],
            keywords,
            payload["color"],
            payload["finish"],
            payload["imageUrl"],
            payload.get("imageCrop", ""),
            1 if payload.get("active", True) else 0,
            payload["promptHint"],
            now_ms(),
        ),
    )
    return next(asset for asset in assets(conn) if asset["id"] == payload["id"])


def update_asset(conn: sqlite3.Connection, asset_id: str, patch: dict) -> dict:
    current = next(asset for asset in assets(conn) if asset["id"] == asset_id)
    current.update(patch)
    keywords = clean(current.get("keywords") or default_asset_keywords(current))
    if not keywords.strip():
        raise ValueError("Asset keywords are required")
    conn.execute(
        """
        UPDATE part_assets
        SET category_id = ?, brand = ?, model = ?, variant = ?, keywords = ?, color = ?, finish = ?, image_url = ?, image_crop = ?, active = ?, prompt_hint = ?
        WHERE id = ?
        """,
        (
            current["categoryId"],
            current["brand"],
            current["model"],
            current["variant"],
            keywords,
            current["color"],
            current["finish"],
            current["imageUrl"],
            current.get("imageCrop", ""),
            1 if current.get("active", True) else 0,
            current["promptHint"],
            asset_id,
        ),
    )
    return next(asset for asset in assets(conn) if asset["id"] == asset_id)


def update_provider(conn: sqlite3.Connection, payload: dict) -> dict:
    provider_id = payload["id"]
    current = next(item for item in providers(conn) if item["id"] == provider_id)
    model_name = payload.get("modelName") or current["modelName"]
    enabled = current["enabled"] if "enabled" not in payload else bool(payload["enabled"])
    api_key = payload.get("apiKey") or ""
    masked = mask_key(api_key) if api_key else current["maskedKey"]
    cipher = hashlib.sha256(api_key.encode("utf-8")).hexdigest() if api_key else None
    conn.execute(
        """
        UPDATE provider_configs
        SET model_name = ?, enabled = ?, api_key_cipher = COALESCE(?, api_key_cipher), api_key_masked = ?, updated_at = ?
        WHERE id = ?
        """,
        (model_name, 1 if enabled else 0, cipher, masked, now_ms(), provider_id),
    )
    return next(item for item in providers(conn) if item["id"] == provider_id)


def create_prompt(conn: sqlite3.Connection, payload: dict) -> dict:
    prompt_id = f"preset_{secrets.token_hex(5)}"
    if payload.get("active", True):
        conn.execute("UPDATE prompt_presets SET active = 0")
    conn.execute(
        "INSERT INTO prompt_presets (id, title, version, body, negative_prompt, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            prompt_id,
            payload["title"],
            payload["version"],
            payload["body"],
            payload["negativePrompt"],
            1 if payload.get("active", True) else 0,
            now_ms(),
        ),
    )
    return next(item for item in prompts(conn) if item["id"] == prompt_id)


def categories(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT * FROM asset_categories ORDER BY sort_order ASC").fetchall()
    return [
        {"id": row["id"], "label": row["label"], "description": row["description"], "sortOrder": int(row["sort_order"])}
        for row in rows
    ]


def assets(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT * FROM part_assets ORDER BY category_id ASC, created_at ASC").fetchall()
    return [
        {
            "id": row["id"],
            "categoryId": row["category_id"],
            "brand": row["brand"],
            "model": row["model"],
            "variant": row["variant"],
            "keywords": row["keywords"] or default_asset_keywords(row),
            "color": row["color"],
            "finish": row["finish"],
            "imageUrl": row["image_url"],
            "imageCrop": row["image_crop"] or "",
            "active": bool(row["active"]),
            "promptHint": row["prompt_hint"],
        }
        for row in rows
    ]


def providers(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT * FROM provider_configs ORDER BY id ASC").fetchall()
    return [
        {
            "id": row["id"],
            "label": row["label"],
            "modelName": row["model_name"],
            "enabled": bool(row["enabled"]),
            "hasApiKey": bool(row["api_key_masked"]),
            "maskedKey": row["api_key_masked"] or "",
            "updatedAt": int(row["updated_at"]),
        }
        for row in rows
    ]


def prompts(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT * FROM prompt_presets ORDER BY created_at DESC").fetchall()
    return [
        {
            "id": row["id"],
            "title": row["title"],
            "version": row["version"],
            "body": row["body"],
            "negativePrompt": row["negative_prompt"],
            "active": bool(row["active"]),
            "createdAt": int(row["created_at"]),
        }
        for row in rows
    ]


def active_prompt(conn: sqlite3.Connection) -> dict:
    row = conn.execute("SELECT * FROM prompt_presets WHERE active = 1 ORDER BY created_at DESC LIMIT 1").fetchone()
    if row:
        return prompts_from_rows([row])[0]
    prompt_list = prompts(conn)
    if not prompt_list:
        raise RuntimeError("No prompt preset available")
    return prompt_list[0]


def prompts_from_rows(rows: list[sqlite3.Row]) -> list[dict]:
    return [
        {
            "id": row["id"],
            "title": row["title"],
            "version": row["version"],
            "body": row["body"],
            "negativePrompt": row["negative_prompt"],
            "active": bool(row["active"]),
            "createdAt": int(row["created_at"]),
        }
        for row in rows
    ]


def map_generation(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "status": row["status"],
        "userId": row["user_id"],
        "provider": row["provider"],
        "vehicleUploadId": row["vehicle_upload_id"],
        "sourceImageUrl": row["source_image_url"],
        "resultImageUrl": row["result_image_url"],
        "paintId": row["paint_id"],
        "stance": int(row["stance"]),
        "selections": json.loads(row["selections_json"] or "{}"),
        "promptSummary": row["prompt_summary"],
        "promptHidden": row["prompt_hidden"],
        "usageUnits": int(row["usage_units"]),
        "createdAt": int(row["created_at"]),
    }


def scalar(conn: sqlite3.Connection, sql: str) -> int:
    return int(conn.execute(sql).fetchone()[0])


def now_ms() -> int:
    return int(time.time() * 1000)


def mask_key(value: str) -> str:
    if len(value) <= 8:
        return "****"
    return f"{value[:4]}...{value[-4:]}"


def clean(value) -> str:
    return str(value).encode("utf-8", "replace").decode("utf-8")


def default_asset_keywords(item: dict) -> str:
    values = []
    for key in ("model", "variant", "id"):
        if hasattr(item, "get"):
            value = item.get(key, "")
        else:
            value = item[key] if key in item.keys() else ""
        normalized = clean(value).strip()
        if normalized:
            values.append(normalized)
    return ", ".join(values)


if __name__ == "__main__":
    main()

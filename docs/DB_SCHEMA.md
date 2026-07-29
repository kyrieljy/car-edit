# 数据库设计

## 概述

- **数据库类型**：SQLite
- **运行时模块**：Node.js 18+ 内置 `node:sqlite` 模块
- **字符集**：UTF-8
- **存储位置**：`data/car_mod_effect.sqlite`
- **WAL 模式**：开启（`PRAGMA journal_mode = WAL`），支持并发读写
- **加密方式**：敏感字段（API Key）采用 AES-256-CBC 加密存储
- **连接配置位置**：`lib/server/db.ts`

## 表清单

| 表名 | 用途 | 关联模块 |
|------|------|----------|
| users | 用户账户 | 认证模块 |
| avatar_presets | 头像预设 | 账户模块 |
| asset_categories | 改装分类 | 资产模块 |
| asset_brands | 配件品牌 | 资产模块 |
| part_assets | 配件资产 | 资产模块 |
| part_asset_references | 配件参考图 | 资产模块 |
| prompt_presets | 提示词预设 | 提示词引擎 |
| prompt_templates | 提示词模板 | 提示词引擎 |
| provider_configs | AI Provider 配置 | 生成引擎 |
| vehicle_uploads | 车辆图片上传 | 生成模块 |
| generation_jobs | AI 生成任务 | 生成模块 |
| usage_ledger | 用量账本（计费） | 计费模块 |
| garage_items | 用户车库收藏 | 车库模块 |
| guardrail_configs | 安全护栏配置 | 安全模块 |
| chat_sessions | 对话会话 | 聊天模块 |
| chat_messages | 对话消息 | 聊天模块 |
| chat_attachments | 对话附件 | 聊天模块 |
| sessions | 登录会话（token_hash） | 认证模块 |
| verification_codes | 短信验证码 | 认证模块 |
| user_identities | 用户身份绑定 | 认证模块 |
| membership_plans | 会员计划 | 计费模块 |
| subscriptions | 用户订阅 | 计费模块 |
| entitlement_usage | 权益使用记录 | 计费模块 |
| payment_orders | 支付订单 | 计费模块 |
| account_messages | 账户消息 | 账户模块 |
| audit_logs | 审计日志 | 管理模块 |
| quota_adjustments | 配额调整记录 | 管理模块 |
| workflow_configs | 工作流编排 | 生成引擎 |
| generation_bad_cases | 生成 Bad Case | 管理模块 |
| alert_records | 异常告警记录 | 运营分析模块 |

## 表结构详情

### users（`users`）

- **用途**：存储用户账户基本信息，包含登录凭证、角色、会员等级及状态
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 用户唯一标识（主键） |
  | username | TEXT | 是 | - | 用户名，全局唯一 |
  | phone | TEXT | 否 | - | 手机号，全局唯一 |
  | password_hash | TEXT | 否 | - | 密码哈希 |
  | avatar_id | TEXT | 否 | - | 头像 ID，关联 avatar_presets |
  | role | TEXT | 是 | `'user'` | 角色标识：`user` / `admin` |
  | plan | TEXT | 是 | `'free'` | 会员等级：`free` / `pro` / `max` |
  | status | TEXT | 是 | `'active'` | 账户状态 |
  | created_at | TEXT | 是 | - | 创建时间（ISO 8601） |
  | updated_at | TEXT | 是 | - | 最后更新时间（ISO 8601） |
  | tags_json | TEXT | 是 | `'[]'` | 手动用户标签（JSON 数组字符串），如 `["vip", "beta-tester"]`（DESIGN-20260729-002 新增） |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | users_username_unique | username | UNIQUE | 用户名唯一约束 |
  | users_phone_unique | phone | UNIQUE | 手机号唯一约束 |

- **约束**：
  - PRIMARY KEY: `id`
  - UNIQUE: `username`, `phone`
- **关联表**：avatar_presets（通过 avatar_id）

---

### avatar_presets（`avatar_presets`）

- **用途**：预定义的头像选项列表
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 头像唯一标识（主键） |
  | name | TEXT | 是 | - | 头像名称 |
  | url | TEXT | 是 | - | 头像图片地址 |
  | sort_order | INTEGER | 否 | 0 | 排序序号 |
  | active | INTEGER | 是 | 1 | 是否启用 |
  | created_at | TEXT | 是 | - | 创建时间 |
  | updated_at | TEXT | 是 | - | 最后更新时间 |

- **索引**：无额外索引
- **约束**：PRIMARY KEY: `id`
- **关联表**：users（通过 avatar_id）

---

### asset_categories（`asset_categories`）

- **用途**：改装配件分类定义（如轮毂、包围、尾翼等 12 个分类）
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 分类唯一标识（主键） |
  | name | TEXT | 是 | - | 分类名称 |
  | icon | TEXT | 否 | - | 分类图标标识 |
  | sort_order | INTEGER | 否 | 0 | 排序序号 |
  | active | INTEGER | 是 | 1 | 是否启用 |
  | created_at | TEXT | 是 | - | 创建时间 |
  | updated_at | TEXT | 是 | - | 最后更新时间 |

- **索引**：无额外索引
- **约束**：PRIMARY KEY: `id`
- **关联表**：part_assets（通过 id）

---

### asset_brands（`asset_brands`）

- **用途**：配件品牌定义
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 品牌唯一标识（主键） |
  | name | TEXT | 是 | - | 品牌名称 |
  | logo_url | TEXT | 否 | - | 品牌Logo地址 |
  | sort_order | INTEGER | 否 | 0 | 排序序号 |
  | active | INTEGER | 是 | 1 | 是否启用 |
  | created_at | TEXT | 是 | - | 创建时间 |
  | updated_at | TEXT | 是 | - | 最后更新时间 |

- **索引**：无额外索引
- **约束**：PRIMARY KEY: `id`
- **关联表**：part_assets（通过 id）

---

### part_assets（`part_assets`）

- **用途**：配件资产定义，记录每个可选配件的属性、颜色策略及提示词信息
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 配件唯一标识（主键） |
  | category_id | TEXT | 是 | - | 所属分类 ID |
  | brand_id | TEXT | 否 | - | 品牌 ID |
  | model | TEXT | 是 | - | 配件型号名称 |
  | color | TEXT | 否 | - | 配件颜色 |
  | finish | TEXT | 否 | - | 表面处理工艺（如哑光、亮光） |
  | prompt_hint | TEXT | 否 | - | 提示词补充描述 |
  | color_policy | TEXT | 是 | `'body_color'` | 颜色策略：`body_color` / `exposed_carbon` / `part_reference_color` |
  | generation_ready | INTEGER | 是 | 1 | 是否可用于生成 |
  | sort_order | INTEGER | 否 | 0 | 排序序号 |
  | active | INTEGER | 是 | 1 | 是否启用 |
  | created_at | TEXT | 是 | - | 创建时间 |
  | updated_at | TEXT | 是 | - | 最后更新时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | part_assets_category_idx | category_id | INDEX | 按分类查询 |
  | part_assets_brand_idx | brand_id | INDEX | 按品牌查询 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：asset_categories（通过 category_id）、asset_brands（通过 brand_id）

---

### part_asset_references（`part_asset_references`）

- **用途**：配件参考图，记录每个配件的参考图片资源
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 记录唯一标识（主键） |
  | part_asset_id | TEXT | 是 | - | 关联配件 ID |
  | image_url | TEXT | 是 | - | 参考图地址 |
  | sort_order | INTEGER | 否 | 0 | 排序序号 |
  | created_at | TEXT | 是 | - | 创建时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | part_refs_asset_idx | part_asset_id | INDEX | 按配件查询参考图 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：part_assets（通过 part_asset_id）

---

### prompt_presets（`prompt_presets`）

- **用途**：预定义的提示词快捷选项
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 预设唯一标识（主键） |
  | label | TEXT | 是 | - | 预设显示名称 |
  | content | TEXT | 是 | - | 预设提示词内容 |
  | sort_order | INTEGER | 否 | 0 | 排序序号 |
  | active | INTEGER | 是 | 1 | 是否启用 |
  | created_at | TEXT | 是 | - | 创建时间 |
  | updated_at | TEXT | 是 | - | 最后更新时间 |

- **索引**：无额外索引
- **约束**：PRIMARY KEY: `id`
- **关联表**：无

---

### prompt_templates（`prompt_templates`）

- **用途**：提示词模板，定义 15 种作用域的提示词内容，是提示词引擎的核心配置
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 模板唯一标识（主键） |
  | scope | TEXT | 是 | - | 模板作用域 |
  | label | TEXT | 是 | - | 模板显示名称 |
  | content | TEXT | 是 | - | 模板内容（含变量占位符） |
  | sort_order | INTEGER | 否 | 0 | 排序序号 |
  | active | INTEGER | 是 | 1 | 是否启用 |
  | created_at | TEXT | 是 | - | 创建时间 |
  | updated_at | TEXT | 是 | - | 最后更新时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | prompt_templates_scope_idx | scope | INDEX | 按作用域查询模板 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：无

**scope 取值说明**：

| 取值 | 用途 |
|------|------|
| base | 基础提示词 |
| config_base | 配置模式基础 |
| config_mode | 配置模式指令 |
| chat_mode | 聊天模式指令 |
| category | 分类级别提示 |
| part | 配件级别提示 |
| combo | 组合配件提示 |
| chat_recommendation | 聊天推荐提示 |
| chat_parser | 聊天意图解析 |
| chat_optimizer | 聊天优化器 |
| vehicle_recognition | 车辆识别 |
| part_recognition | 配件识别 |
| negative | 负面提示词 |
| result_check | 结果检查 |
| retry | 重试提示词 |

---

### provider_configs（`provider_configs`）

- **用途**：AI 服务提供商配置，支持多 Provider 管理，API Key 使用 AES-256-CBC 加密存储
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | Provider 唯一标识（主键） |
  | label | TEXT | 是 | - | Provider 显示名称 |
  | capability | TEXT | 是 | - | 能力类型 |
  | base_url | TEXT | 是 | - | API 基础地址 |
  | model_name | TEXT | 是 | - | 模型名称 |
  | api_key_encrypted | TEXT | 否 | - | API Key 密文（AES-256-CBC） |
  | is_active | INTEGER | 是 | 1 | 是否启用 |
  | sort_order | INTEGER | 否 | 0 | 排序序号 |
  | created_at | TEXT | 是 | - | 创建时间 |
  | updated_at | TEXT | 是 | - | 最后更新时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | provider_configs_capability_idx | capability | INDEX | 按能力类型查询 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：generation_jobs（通过 id）

**capability 取值说明**：

| 取值 | 用途 |
|------|------|
| llm | 大语言模型（意图解析） |
| vision | 视觉识别（车辆/配件识别） |
| image_generation | 图片生成 |
| embedding | 向量嵌入 |

---

### vehicle_uploads（`vehicle_uploads`）

- **用途**：用户上传的车辆图片记录
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 上传记录唯一标识（主键） |
  | user_id | TEXT | 是 | - | 上传用户 ID |
  | original_url | TEXT | 是 | - | 原始图片地址 |
  | storage_path | TEXT | 是 | - | 存储路径 |
  | file_size | INTEGER | 否 | - | 文件大小（字节） |
  | created_at | TEXT | 是 | - | 创建时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | vehicle_uploads_user_idx | user_id | INDEX | 按用户查询上传记录 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：users（通过 user_id）

---

### generation_jobs（`generation_jobs`）

- **用途**：AI 生成任务记录，跟踪从创建到完成的完整生命周期，是生成引擎的核心数据表
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 任务唯一标识（主键） |
  | user_id | TEXT | 是 | - | 发起用户 ID |
  | mode | TEXT | 是 | - | 生成模式：`config` / `chat` |
  | status | TEXT | 是 | - | 任务状态 |
  | standard_json | TEXT | 否 | - | 标准化 JSON（配件/车辆/提示词结构） |
  | prompt | TEXT | 否 | - | 最终发送给 Provider 的提示词 |
  | result_url | TEXT | 否 | - | 生成结果图片地址 |
  | source_url | TEXT | 否 | - | 原始车辆图片地址 |
  | vehicle_info | TEXT | 否 | - | 车辆识别结果 JSON |
  | progress_json | TEXT | 否 | - | 16 步流水线进度 JSON |
  | error_message | TEXT | 否 | - | 错误信息 |
  | provider_id | TEXT | 否 | - | 使用的 Provider ID |
  | cost_credits | INTEGER | 否 | 0 | 消耗积分 |
  | created_at | TEXT | 是 | - | 创建时间 |
  | updated_at | TEXT | 是 | - | 最后更新时间 |
  | completed_at | TEXT | 否 | - | 完成时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | gen_jobs_user_idx | user_id | INDEX | 按用户查询任务 |
  | gen_jobs_status_idx | status | INDEX | 按状态筛选任务 |
  | gen_jobs_created_idx | created_at | INDEX | 按时间排序查询 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：users（通过 user_id）、provider_configs（通过 provider_id）、usage_ledger（通过 generation_job_id）

**status 取值说明**：

| 取值 | 用途 |
|------|------|
| queued | 已入队，等待执行 |
| running | 正在执行中 |
| succeeded | 生成成功 |
| failed | 生成失败 |

---

### usage_ledger（`usage_ledger`）

- **用途**：用量账本，记录每次生成操作的积分消耗，用于计费与额度控制
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 记录唯一标识（主键） |
  | user_id | TEXT | 是 | - | 用户 ID |
  | event | TEXT | 是 | - | 事件类型 |
  | credits | INTEGER | 是 | - | 积分变动量（正数为消耗） |
  | generation_job_id | TEXT | 否 | - | 关联的生成任务 ID |
  | created_at | TEXT | 是 | - | 创建时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | usage_ledger_user_idx | user_id | INDEX | 按用户查询用量 |
  | usage_ledger_created_idx | created_at | INDEX | 按时间排序查询 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：users（通过 user_id）、generation_jobs（通过 generation_job_id）

**event 取值说明**：

| 取值 | 用途 |
|------|------|
| config_generation | 配置模式生成 |
| chat_generation | 聊天模式生成 |

---

### garage_items（`garage_items`）

- **用途**：用户车库收藏，保存用户收藏的生成结果
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 收藏记录唯一标识（主键） |
  | user_id | TEXT | 是 | - | 用户 ID |
  | generation_job_id | TEXT | 是 | - | 关联的生成任务 ID |
  | created_at | TEXT | 是 | - | 收藏时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | garage_items_user_idx | user_id | INDEX | 按用户查询收藏 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：users（通过 user_id）、generation_jobs（通过 generation_job_id）

---

### guardrail_configs（`guardrail_configs`）

- **用途**：内容安全护栏配置，包含关键词黑名单及测试控制
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 配置唯一标识（主键） |
  | blocked_keywords | TEXT | 是 | `'[]'` | 屏蔽关键词列表（JSON 数组） |
  | mock_fail_uploads | INTEGER | 是 | 0 | 模拟上传失败次数（用于测试） |
  | updated_at | TEXT | 是 | - | 最后更新时间 |

- **索引**：无额外索引
- **约束**：PRIMARY KEY: `id`
- **关联表**：无

---

### chat_sessions（`chat_sessions`）

- **用途**：对话会话，管理用户的聊天会话生命周期
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 会话唯一标识（主键） |
  | user_id | TEXT | 是 | - | 所属用户 ID |
  | title | TEXT | 否 | - | 会话标题 |
  | pinned | INTEGER | 是 | 0 | 是否置顶 |
  | created_at | TEXT | 是 | - | 创建时间 |
  | updated_at | TEXT | 是 | - | 最后更新时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | chat_sessions_user_idx | user_id | INDEX | 按用户查询会话 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：users（通过 user_id）、chat_messages（通过 id）

---

### chat_messages（`chat_messages`）

- **用途**：对话消息，记录会话中的每一条用户与助手消息
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 消息唯一标识（主键） |
  | session_id | TEXT | 是 | - | 所属会话 ID |
  | role | TEXT | 是 | - | 消息角色：`user` / `assistant` |
  | content | TEXT | 是 | - | 消息文本内容 |
  | standard_json | TEXT | 否 | - | 标准化 JSON（配件解析结果） |
  | attachments_json | TEXT | 否 | - | 附件列表 JSON |
  | dry_run | INTEGER | 是 | 0 | 是否为试运行（不计费） |
  | created_at | TEXT | 是 | - | 创建时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | chat_messages_session_idx | session_id | INDEX | 按会话查询消息 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：chat_sessions（通过 session_id）

---

### chat_attachments（`chat_attachments`）

- **用途**：对话附件，记录聊天消息中的图片等附件资源
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 附件唯一标识（主键） |
  | message_id | TEXT | 是 | - | 关联消息 ID |
  | url | TEXT | 是 | - | 附件地址 |
  | type | TEXT | 否 | - | 附件类型 |
  | created_at | TEXT | 是 | - | 创建时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | chat_attach_message_idx | message_id | INDEX | 按消息查询附件 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：chat_messages（通过 message_id）

---

### sessions（`sessions`）

- **用途**：登录会话管理，通过 token_hash 实现基于 Cookie 的 Session 认证
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 会话唯一标识（主键） |
  | user_id | TEXT | 是 | - | 关联用户 ID |
  | token_hash | TEXT | 是 | - | Token 哈希值 |
  | created_at | TEXT | 是 | - | 创建时间 |
  | expires_at | TEXT | 是 | - | 过期时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | sessions_token_hash_unique | token_hash | UNIQUE | Token 哈希唯一约束 |
  | sessions_user_idx | user_id | INDEX | 按用户查询活跃会话 |

- **约束**：
  - PRIMARY KEY: `id`
  - UNIQUE: `token_hash`
- **关联表**：users（通过 user_id）

---

### verification_codes（`verification_codes`）

- **用途**：短信验证码记录，用于登录验证及手机换绑
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 记录唯一标识（主键） |
  | phone | TEXT | 是 | - | 目标手机号 |
  | code | TEXT | 是 | - | 验证码 |
  | purpose | TEXT | 是 | - | 用途（login / bind_phone / reset_password） |
  | expires_at | TEXT | 是 | - | 过期时间 |
  | used | INTEGER | 是 | 0 | 是否已使用 |
  | created_at | TEXT | 是 | - | 创建时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | verify_codes_phone_idx | phone | INDEX | 按手机号查询验证码 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：无

---

### user_identities（`user_identities`）

- **用途**：用户身份绑定，记录用户关联的第三方身份信息
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 记录唯一标识（主键） |
  | user_id | TEXT | 是 | - | 关联用户 ID |
  | provider | TEXT | 是 | - | 身份提供方 |
  | provider_user_id | TEXT | 是 | - | 提供方用户标识 |
  | created_at | TEXT | 是 | - | 创建时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | user_identities_user_idx | user_id | INDEX | 按用户查询绑定身份 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：users（通过 user_id）

---

### membership_plans（`membership_plans`）

- **用途**：会员计划定义，定义 free / pro / max 三级会员的权益与定价
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 计划唯一标识（主键）：`free` / `pro` / `max` |
  | label | TEXT | 是 | - | 计划显示名称 |
  | credits_per_month | INTEGER | 是 | - | 每月积分额度 |
  | config_limit | INTEGER | 是 | - | 每月配置生成上限（-1 表示无限） |
  | chat_daily_limit | INTEGER | 是 | - | 每日聊天上限（-1 表示无限） |
  | price_monthly | REAL | 否 | 0 | 月付价格 |
  | price_yearly | REAL | 否 | 0 | 年付价格 |
  | sort_order | INTEGER | 否 | 0 | 排序序号 |
  | active | INTEGER | 是 | 1 | 是否启用 |

- **索引**：无额外索引
- **约束**：PRIMARY KEY: `id`（计划 ID 本身为业务主键）
- **关联表**：users（通过 plan）、subscriptions（通过 plan_id）

---

### subscriptions（`subscriptions`）

- **用途**：用户订阅记录，关联用户与会员计划
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 订阅唯一标识（主键） |
  | user_id | TEXT | 是 | - | 用户 ID |
  | plan_id | TEXT | 是 | - | 会员计划 ID |
  | status | TEXT | 是 | - | 订阅状态（active / expired / cancelled） |
  | started_at | TEXT | 是 | - | 开始时间 |
  | expires_at | TEXT | 是 | - | 到期时间 |
  | created_at | TEXT | 是 | - | 创建时间 |
  | updated_at | TEXT | 是 | - | 最后更新时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | subscriptions_user_idx | user_id | INDEX | 按用户查询订阅 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：users（通过 user_id）、membership_plans（通过 plan_id）

---

### entitlement_usage（`entitlement_usage`）

- **用途**：权益使用记录，跟踪用户各类权益的使用情况
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 记录唯一标识（主键） |
  | user_id | TEXT | 是 | - | 用户 ID |
  | entitlement_type | TEXT | 是 | - | 权益类型 |
  | amount | INTEGER | 是 | - | 使用量 |
  | period_start | TEXT | 是 | - | 计费周期起始 |
  | period_end | TEXT | 是 | - | 计费周期截止 |
  | created_at | TEXT | 是 | - | 创建时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | entitlement_usage_user_idx | user_id | INDEX | 按用户查询权益使用 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：users（通过 user_id）

---

### payment_orders（`payment_orders`）

- **用途**：支付订单，记录用户的购买交易信息
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 订单唯一标识（主键） |
  | user_id | TEXT | 是 | - | 用户 ID |
  | plan_id | TEXT | 是 | - | 购买的会员计划 ID |
  | method | TEXT | 是 | - | 支付方式（`wechat` / `alipay`） |
  | amount_cents | INTEGER | 是 | - | 支付金额（分），如 2900 = ¥29.00 |
  | status | TEXT | 是 | - | 订单状态（pending / paid / failed / refunded） |
  | created_at | TEXT | 是 | - | 创建时间 |
  | updated_at | TEXT | 是 | - | 最后更新时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | payment_orders_user_idx | user_id | INDEX | 按用户查询订单 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：users（通过 user_id）、membership_plans（通过 plan_id）

---

### account_messages（`account_messages`）

- **用途**：账户消息，系统向用户发送的通知消息
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 消息唯一标识（主键） |
  | user_id | TEXT | 是 | - | 目标用户 ID |
  | title | TEXT | 是 | - | 消息标题 |
  | content | TEXT | 是 | - | 消息内容 |
  | type | TEXT | 否 | - | 消息类型（system / promo / billing） |
  | read | INTEGER | 是 | 0 | 是否已读 |
  | created_at | TEXT | 是 | - | 创建时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | account_messages_user_idx | user_id | INDEX | 按用户查询消息 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：users（通过 user_id）

---

### audit_logs（`audit_logs`）

- **用途**：审计日志，记录管理操作及关键系统行为
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 日志唯一标识（主键） |
  | actor_id | TEXT | 否 | - | 操作者用户 ID |
  | action | TEXT | 是 | - | 操作动作 |
  | target_type | TEXT | 否 | - | 操作目标类型 |
  | target_id | TEXT | 否 | - | 操作目标 ID |
  | detail_json | TEXT | 否 | - | 操作详情 JSON |
  | created_at | TEXT | 是 | - | 创建时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | audit_logs_actor_idx | actor_id | INDEX | 按操作者查询 |
  | audit_logs_created_idx | created_at | INDEX | 按时间排序查询 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：users（通过 actor_id）

---

### quota_adjustments（`quota_adjustments`）

- **用途**：配额调整记录，记录管理员对用户积分的调整操作
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 记录唯一标识（主键） |
  | user_id | TEXT | 是 | - | 目标用户 ID |
  | amount | INTEGER | 是 | - | 调整量（正数为增加） |
  | reason | TEXT | 否 | - | 调整原因 |
  | operator_id | TEXT | 是 | - | 操作者 ID |
  | created_at | TEXT | 是 | - | 创建时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | quota_adj_user_idx | user_id | INDEX | 按用户查询调整记录 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：users（通过 user_id）

---

### workflow_configs（`workflow_configs`）

- **用途**：工作流编排配置，定义识别、配置、聊天三种模式下的节点/边/失败策略
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 工作流唯一标识（主键） |
  | mode | TEXT | 是 | - | 工作流模式：`recognition` / `config` / `chat` |
  | label | TEXT | 是 | - | 工作流显示名称 |
  | config_json | TEXT | 是 | - | 工作流配置 JSON（含 nodes / edges / failureStrategies） |
  | is_active | INTEGER | 是 | 1 | 是否启用 |
  | created_at | TEXT | 是 | - | 创建时间 |
  | updated_at | TEXT | 是 | - | 最后更新时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | workflow_configs_mode_idx | mode | INDEX | 按模式查询工作流 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：无

---

### generation_bad_cases（`generation_bad_cases`）

- **用途**：生成 Bad Case 记录，用于管理后台收集和分析生成质量问题
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 记录唯一标识（主键） |
  | generation_job_id | TEXT | 是 | - | 关联的生成任务 ID |
  | reason | TEXT | 否 | - | 判定原因 |
  | resolution | TEXT | 否 | - | 处理方案 |
  | resolved | INTEGER | 是 | 0 | 是否已处理 |
  | created_at | TEXT | 是 | - | 创建时间 |
  | updated_at | TEXT | 是 | - | 最后更新时间 |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | bad_cases_job_idx | generation_job_id | INDEX | 按生成任务查询 Bad Case |

- **约束**：PRIMARY KEY: `id`
- **关联表**：generation_jobs（通过 generation_job_id）

---

### alert_records（`alert_records`）

- **用途**：存储异常告警记录，用于运营分析平台的额度监控模块。当系统检测到用户高频生成或高成本异常时自动写入告警记录，管理员可确认或忽略。
- **字段**：

  | 字段名 | 类型 | 是否必填 | 默认值 | 描述 |
  |--------|------|----------|--------|------|
  | id | TEXT | 是 | - | 记录唯一标识（主键） |
  | user_id | TEXT | 是 | - | 关联的用户 ID |
  | alert_type | TEXT | 是 | - | 告警类型（`high_frequency` / `high_cost`） |
  | alert_value | INTEGER | 是 | - | 触发值（高频：生成次数；高成本：成本分） |
  | detected_at | INTEGER | 是 | - | 检测时间戳（毫秒） |
  | status | TEXT | 是 | `pending` | 处理状态（`pending` / `confirmed` / `ignored`） |
  | resolved_at | INTEGER | 否 | - | 处理时间戳（毫秒） |
  | resolver_id | TEXT | 否 | - | 处理人（管理员）用户 ID |

- **索引**：

  | 索引名 | 字段 | 类型 | 说明 |
  |--------|------|------|------|
  | alert_records_user_idx | user_id | INDEX | 按用户查询告警 |
  | alert_records_detected_idx | detected_at DESC | INDEX | 按检测时间倒序查询 |
  | alert_records_status_idx | status | INDEX | 按状态筛选告警 |

- **约束**：PRIMARY KEY: `id`
- **关联表**：users（通过 user_id）

---

> 最后更新时间：2026-07-29
> 关联方案ID：DESIGN-20260729-002、DESIGN-20260729-003

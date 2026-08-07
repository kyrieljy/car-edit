# 配置 常见问题

## Q：AI Provider 连接失败，返回 502 错误
**现象**：用户提交生成请求后，系统返回 502 错误，错误信息提示上游服务不可用。

**根因**：AI Provider 的 API Key 无效、已过期，或 Provider 服务地址配置错误。API Key 以 AES-256-CBC 加密存储于数据库 `provider_configs` 表中。

**解决方案**：
1. 以管理员身份登录管理后台（`/admin`）。
2. 进入 "Provider" 模块，检查目标 Provider 的配置。
3. 确认 `base_url` 地址正确且可访问。
4. 更新 `api_key` 为有效的密钥。
5. 保存配置后重新提交生成请求。

---

## Q：短信验证码发送失败
**现象**：用户尝试登录时，点击"发送验证码"后无反应或收到错误提示。

**根因**：阿里云短信服务（DYPNS）配置缺失或 AccessKey 无权限。非生产环境下系统会自动降级为 mock 模式。

**解决方案**：
1. 确认环境变量中已配置阿里云 AccessKey ID 和 AccessKey Secret。
2. 确认短信模板码（TemplateCode）已审核通过。
3. 如果是本地开发环境，检查是否为非生产环境——非生产环境应自动使用 mock 模式并返回 `devCode`。
4. 生产环境需联系阿里云确认短信服务状态。

---

## Q：图片代理接口（proxy-image）返回 403
**现象**：前端请求 `/api/proxy-image?url=xxx` 时返回 403 Forbidden。

**根因**：图片代理仅允许白名单域名的 URL：`fal.media` 和 `file.302.ai`。请求的图片 URL 不在白名单内。

**解决方案**：
1. 检查请求的图片 URL 域名是否为 `fal.media` 或 `file.302.ai`。
2. 如需新增白名单域名，修改 `app/api/proxy-image/route.ts` 中的域名白名单。
3. 或将图片下载到本地存储，通过本地 URL 访问。

---

## Q：管理后台设置了公网域名（PUBLIC_ASSET_BASE_URL）但不生效
**现象**：在管理后台"系统配置 > 域名配置"页面保存公网域名后，生图 API 仍然报错提示需要公网 URL，或"当前生效域名"仍显示为空。

**根因**：`site_configs` 表的初始 seed 行未插入。`seed()` 函数中 `site_configs` 的 INSERT 语句位于 `shouldSeedLegacyStaticConfig()` 早返回检查之后，当环境变量 `CAR_MOD_LEGACY_STATIC_DB_SEED` 未设为 `1` 时（常见情况），seed 函数在到达 `site_configs` INSERT 之前就 return 了，导致表存在但无 `id='default'` 行。同时 `updateSiteConfig()` 使用 `UPDATE ... WHERE id='default'`，对不存在的行执行 UPDATE 会静默失败（`changes: 0`），保存操作看似成功但数据从未写入。

**解决方案**：已修复（DESIGN-20260806-006 后续修复）：
1. 将 `seedSiteConfig()` 调用移到 `shouldSeedLegacyStaticConfig()` 早返回之前，确保无论环境变量如何设置，`site_configs` 表始终有初始行。
2. 将 `updateSiteConfig()` 从 `UPDATE` 改为 `INSERT ... ON CONFLICT(id) DO UPDATE`（UPSERT），确保即使行不存在也能创建。

**关联方案**：DESIGN-20260806-006

---

> 最后更新时间：2026-08-06

# 变更日志

所有条目按时间倒序排列，新条目置顶。

## 2026-08-10

### 对话模式侧边栏头部精简与折叠按钮重排 (DESIGN-20260810-001)

#### 修改
- [修改] `components/chat-mode.tsx` `ChatHistorySidebar`：PC 桌面端移除顶部 "* AI 助手" 头部整行（星标 + 文字 + 折叠按钮），折叠按钮下移到搜索框同一行左侧（`.chat-search-row` 包裹按钮 + `.chat-search`），点击仍折叠侧边栏；移动端抽屉头部（含 X 关闭）保持不变 (关联方案ID: DESIGN-20260810-001)
- [修改] `app/globals.css` 新增 `.chat-search-row` / `.chat-search-toggle` 布局与按钮样式；`.chat-search` 改为 `flex:1` 且 `margin:0`；短视口媒体查询的目标类由 `.chat-search` 改为 `.chat-search-row` (关联方案ID: DESIGN-20260810-001)
- [修改] `components/chat-mode.tsx` 折叠态（88px）：移除 `collapsed-actions` 中的「新建对话」(`+`) 与「搜索」(放大镜) 两个按钮，改为单个向右箭头 `>` (`ChevronRight`) 展开按钮（`.chat-expand-toggle`，点击 `setCollapsed(false)` 展开）；新增 `expand` 文案键（中/英）；`app/globals.css` 新增 `.collapsed-actions .chat-expand-toggle` 描边样式 (关联方案ID: DESIGN-20260810-001)
- [修改] 折叠态显示微调：折叠宽度由 88px 收窄为 44px（`.chat-history-sidebar.collapsed` 两处 width 及 `ChatHistorySidebar` 的 `animate` 内联宽度同步改为 44）；`.collapsed-actions button` 由 48×48 缩为 34×34 以适配窄条；移除 `.chat-expand-toggle` 描边（无边框的 `>` 按钮） (关联方案ID: DESIGN-20260810-001)

#### 影响
- 桌面端侧边栏顶部更紧凑，折叠/展开（320px ↔ 88px）能力与动画保持不变；折叠态经 `collapsed-actions` 搜索按钮再展开。
- 移动端抽屉 UI 与关闭行为无回归。

## 2026-08-07

### 模型 API 画质参数可配置化 (DESIGN-20260807-001)

#### 新增
- [新增] `lib/provider-image-params.ts` 同构模块：端点类型判定纯函数、6 套内置默认画质模板、保留值常量（`__auto__` / 不传）、参数清洗与校验函数 (关联方案ID: DESIGN-20260807-001)
- [新增] `lib/server/provider-param-injector.ts` 参数注入器：解析生效参数字典（含不传跳过、`__auto__` 自适应推导、`output_compression` 依赖判断）、写入 FormData、按点号路径写入嵌套 JSON payload (关联方案ID: DESIGN-20260807-001)

#### 修改
- [修改] `lib/types.ts` 新增 `ProviderImageParam` / `ProviderOptions` / `ImageParamTemplateKey` 类型，`ProviderConfig` 新增 `options` 字段 (关联方案ID: DESIGN-20260807-001)
- [修改] `lib/server/db.ts` `provider_configs` 建表新增 `options_json` 列；`migrateSchema()` 新增列检测与首次迁移回填（`backfillProviderImageParams()`）；`mapProviderRow()` 按 DB 优先方式映射 `options`；`updateProvider()` 支持 `imageParams`；`seedProviderConfigs()` INSERT 纳入新列但排除于 ON CONFLICT (关联方案ID: DESIGN-20260807-001)
- [修改] `lib/catalog.ts` `providerSeed` 通过模板模块为各条记录生成 `options` 默认值 (关联方案ID: DESIGN-20260807-001)
- [修改] `lib/server/generation-provider.ts` 移除 6 处硬编码/环境变量画质读取（`fast302ImageOptions()`、`yunwuImageQuality/OutputFormat/OutputCompression()`、`yunwuGeminiImageSize()` 等），改为调用注入器；端点判定谓词改为从同构模块导入；导出 5 个供注入器复用的函数 (关联方案ID: DESIGN-20260807-001)
- [修改] `lib/server/provider-test.ts` `sendMinimalTestRequest()` 及各端点测试函数携带画质参数；细化 4xx 分类以识别「参数配置错误」 (关联方案ID: DESIGN-20260807-001)
- [修改] `app/api/admin/provider-configs/route.ts` 请求体白名单新增 `imageParams` 并接入校验 (关联方案ID: DESIGN-20260807-001)
- [修改] `components/admin-console.tsx` `ProviderFields` 新增「画质参数」分区与 `ProviderImageParamsEditor` 子组件；表单数据流（`providerToFormValue` / `providerPayloadFromForm` / `emptyProviderForm` / 隐藏字段）同步 (关联方案ID: DESIGN-20260807-001)
- [修改] `app/globals.css` 新增画质参数分区样式（基础 + admin-clinical 主题） (关联方案ID: DESIGN-20260807-001)

#### 影响
- 管理后台「模型 API」中具备「图片生成」能力的 Provider 可直接编辑各生图接口的画质参数（参数名、枚举、当前值均可编辑），保存后用户下一次生成即按新配置调用 API，无需改代码重新部署
- 引入两个保留值语义：空串「不传（使用平台默认）」、`__auto__`「跟随原图（自适应推导）」，与 API 原生 `auto`（平台决定）区分
- `YUNWU_IMAGE_QUALITY` / `YUNWU_IMAGE_OUTPUT_FORMAT` / `YUNWU_IMAGE_OUTPUT_COMPRESSION` / `YUNWU_IMAGE_SIZE` / `YUNWU_GEMINI_IMAGE_SIZE` / `YUNWU_NANO_RESOLUTION` / `NANO_BANANA_302_RESOLUTION` 等环境变量被后台配置取代，标记为废弃
- 内置默认值严格等于升级前运行时行为，未改配置时出图效果零变化

#### 文档
- [文档] `docs/API_REFERENCE.md` 新增 `POST /api/admin/provider-configs` 详细文档（`imageParams` 字段与校验规则）、`test-all` 补充「参数配置错误」语义、catalog/summary 补充 `options` 字段 (关联方案ID: DESIGN-20260807-001)
- [文档] `docs/DB_SCHEMA.md` `provider_configs` 表新增 `options_json` 列、JSON 结构说明与迁移记录 (关联方案ID: DESIGN-20260807-001)
- [文档] `docs/ARCHITECTURE.md` 核心模块表补充画质参数配置，新增 ADR-0007 (关联方案ID: DESIGN-20260807-001)
- [文档] `docs/BUSINESS_DOMAIN.md` 新增「画质参数」业务概念与两类协议差异说明 (关联方案ID: DESIGN-20260807-001)
- [文档] `README.md` 标注画质相关环境变量已被后台配置取代 (关联方案ID: DESIGN-20260807-001)
- [文档] `docs/models.md` 各 Provider 表格新增「画质配置」列 (关联方案ID: DESIGN-20260807-001)
- [文档] `docs/302-image-quality-tuning.md` 补充结论已被后台配置取代的说明 (关联方案ID: DESIGN-20260807-001)

### 画质参数对比测试与测试配件设置 (DESIGN-20260807-002)

#### 新增
- [新增] `components/config-panel/part-option-subcomponents.tsx` 共享模块：从 `car-mod-studio.tsx` 抽取 6 个配件 configType 子组件（`DryCarbonPartsList`/`WingStyleList`/`ExhaustLayoutList`/`SurfaceInstallControl`/`CaliperCaseList`/`PartOptionsPanel`）+ 4 个类型守卫 + 依赖常量/helper，供用户端与管理后台「测试配件设置」复用（采用用户确认的「折中抽取」方案，外层壳由两端各自组合） (关联方案ID: DESIGN-20260807-002)
- [新增] `lib/server/generation-engine.ts` `runAdminImageParamTest(input)`：强制生图 Provider + Provider 浅克隆覆盖单画质参数值（不写 `provider_configs`）+ 关闭 fallback + 跳过 `createGeneration`/额度、复用完整工作流（提示词/参考图/质检重试），结果图落 `results/` 但不写 `generation_jobs`/`usage_ledger` (关联方案ID: DESIGN-20260807-002)
- [新增] `app/api/admin/test-config/route.ts` `GET`/`PUT` 全局测试配件设置读写（原图经既有 `/api/admin/uploads` 上传后引用） (关联方案ID: DESIGN-20260807-002)
- [新增] `app/api/admin/provider-configs/compare-test/route.ts` `GET` 查缓存 / `POST` 运行对比测试：全量并行 `Promise.allSettled` + 单值 `regenerateValue` 重跑，前置校验 Provider 能力与测试配件设置存在 (关联方案ID: DESIGN-20260807-002)
- [新增] `lib/types.ts` `AdminTestConfig` / `SaveAdminTestConfigInput` / `ImageParamTestResult` 类型 (关联方案ID: DESIGN-20260807-002)
- [新增] `lib/server/db.ts` 建表 `admin_test_config`（全局单行）、`admin_image_param_tests`（UNIQUE(provider_id, param_key, param_value)）+ 索引；新增 CRUD `getAdminTestConfig`/`saveAdminTestConfig`/`listImageParamTests`/`upsertImageParamTest` (关联方案ID: DESIGN-20260807-002)

#### 修改
- [修改] `components/admin-console.tsx` 「画质参数」分区每个参数行新增「对比测试」按钮（从 `ProviderManagerV3`→`ProviderFields`→`ProviderImageParamsEditor` 透传 `providerId`；新建未落库 Provider 禁用）；新增 `ImageParamCompareModal`（复刻 `ProviderTestModal` 单层 portal 弹窗，三列列表 + 每行「重新生成」）；`provider-sections` 后追加 `AdminTestConfigPanel`（原图上传 + 配件手风琴 + 车漆 + 姿态 + 保存） (关联方案ID: DESIGN-20260807-002)
- [修改] `components/car-mod-studio.tsx` 左半 6 个 configType 子组件与类型守卫改为从 `part-option-subcomponents.tsx` 导入复用，业务状态与交互函数保留（零行为变化） (关联方案ID: DESIGN-20260807-002)
- [修改] `app/globals.css` 新增对比测试按钮、对比结果弹窗表格、测试配件设置分区样式（引用既有 CSS 变量，遵循 ADR-0004） (关联方案ID: DESIGN-20260807-002)

#### 影响
- 管理后台「模型 API」菜单最底部新增「测试配件设置」分区（页面效果与用户配置页左半一致），保存后全局固定，所有 Provider 的画质参数对比测试统一取用
- 具备「图片生成」能力的 Provider，其「画质参数」分区每个参数行可点「对比测试」：首次对该参数全部枚举值并行真实生图、弹窗列表展示（枚举值 / 效果图 / 重新生成），非首次直接展示缓存，「重新生成」仅重跑单值
- 对比测试为真实生图，走完整工作流但**不扣用户额度、不写 `generation_jobs`/`usage_ledger`**，与用户生成记录天然隔离；结果按 (Provider, 参数, 枚举值) 持久化缓存，纯缓存不失效
- 被测 Provider 采用浅克隆覆盖单参数值，**绝不改写 `provider_configs`**，规避 codeOwned 覆盖与配置污染；Provider 未启用/无能力/缺 Key 时对应行标记失败且不回退 fallback
- 「一键测试所有模型」(`test-all`) 保持不变：其为最小连通性测试（不出图），与对比测试（真实出图）职责区分并存

#### 文档
- [文档] `docs/API_REFERENCE.md` 新增 `GET`/`PUT /api/admin/test-config` 与 `GET`/`POST /api/admin/provider-configs/compare-test` 四个端点文档 (关联方案ID: DESIGN-20260807-002)
- [文档] `docs/DB_SCHEMA.md` 新增 `admin_test_config`、`admin_image_param_tests` 两表结构与索引、约束、迁移记录 (关联方案ID: DESIGN-20260807-002)
- [文档] `docs/ARCHITECTURE.md` 管理后台模块职责补充「画质对比测试」与「测试配件设置」，新增 ADR-0008 记录「Provider 浅克隆覆盖参数 + 短时生图不落用户记录」决策 (关联方案ID: DESIGN-20260807-002)
- [文档] `docs/BUSINESS_DOMAIN.md` 术语表新增「测试配件设置」「画质参数对比测试」，并说明其与用户生成的区别 (关联方案ID: DESIGN-20260807-002)

### 一键测试支持停用模型 (DESIGN-20260806-007)

#### 修改
- [修改] `lib/server/provider-test.ts` `testProvider()` 移除 `!provider.enabled` 跳过分支，停用的 Provider（已配置 API Key）现纳入并行测试范围，返回"可用"或"不可用"状态而非"跳过" (关联方案ID: DESIGN-20260806-007)

#### 影响
- 管理后台"模型 API"页面"一键测试所有模型"按钮现对所有非 mock/local 且已配置 API Key 的 Provider 发起测试，无论启用或停用
- 帮助管理员验证临时停用的 Provider 是否仍然可用，评估是否可重新启用
- mock/local Provider 和未配置 API Key 的 Provider 仍显示"跳过"，行为不变

## 2026-08-06

### 修复公网域名配置不生效 (DESIGN-20260806-006 后续修复)

#### 修复
- [修复] `lib/server/db.ts` `seedSiteConfig()` 调用从 `shouldSeedLegacyStaticConfig()` 早返回之后移到之前，确保 `site_configs` 表始终有初始行
- [修复] `lib/server/db.ts` `updateSiteConfig()` 从 `UPDATE` 改为 `INSERT ... ON CONFLICT(id) DO UPDATE`（UPSERT），修复行不存在时保存静默失败的问题

#### 影响
- 修复管理后台保存公网域名后不生效的问题（根因：seed 未插入初始行 + UPDATE 对空表静默失败）

### 公网域名配置管理 (DESIGN-20260806-006)

#### 新增
- [新增] `lib/types.ts` 新增 `SiteConfig` 类型，`AdminSummary` 新增 `siteConfig` 字段 (关联方案ID: DESIGN-20260806-006)
- [新增] `lib/catalog.ts` 新增 `siteConfigSeed` 种子数据 (关联方案ID: DESIGN-20260806-006)
- [新增] `lib/server/db.ts` 新增 `site_configs` 表、`getSiteConfig()` / `updateSiteConfig()` / `mapSiteConfig()` 函数 (关联方案ID: DESIGN-20260806-006)
- [新增] `app/api/admin/site-config/route.ts` 域名配置 GET / POST API 端点，含 URL 合法性和 localhost 校验 (关联方案ID: DESIGN-20260806-006)
- [新增] `components/admin-console.tsx` 系统配置分类下新增"域名配置"菜单项和 `DomainConfigManager` 面板组件 (关联方案ID: DESIGN-20260806-006)

#### 修改
- [修改] `lib/server/db.ts` `getAdminSummary()` 返回 `siteConfig` 字段，`seedDatabase` 插入 `site_configs` 种子数据 (关联方案ID: DESIGN-20260806-006)
- [修改] `lib/server/generation-provider.ts` `providerInputPublicBaseUrl()` 改为 async，优先读取数据库 `site_configs` 配置，为空时回退环境变量链路 (关联方案ID: DESIGN-20260806-006)

#### 文档
- [文档] `docs/API_REFERENCE.md` 新增 `GET/POST /api/admin/site-config` 接口文档 (关联方案ID: DESIGN-20260806-006)
- [文档] `docs/DB_SCHEMA.md` 新增 `site_configs` 表结构文档 (关联方案ID: DESIGN-20260806-006)
- [文档] `docs/ARCHITECTURE.md` 核心模块表更新图片存储模块，环境配置新增公网域名说明，表数量更新为 24 张 (关联方案ID: DESIGN-20260806-006)

#### 影响范围
- 管理后台新增"域名配置"页面，管理员可直接编辑公网域名并立即生效
- 调用 Nano-Banana / Gemini 生图 API 时，图片链接使用数据库配置的域名拼接
- 数据库未配置时回退到环境变量，现有行为不变
- OpenAI 兼容 `images/edits` 路径发送二进制数据，不受影响

### 管理员二级菜单改造 (DESIGN-20260806-005)

#### 修改
- [修改] `components/admin-console.tsx` 将 23 个一级平铺菜单改造为二级菜单结构：数据看板独立置顶，其余 22 个菜单按业务职能分为 5 个一级分组（系统配置 / 商业运营 / 用户与安全 / 数据分析 / 运维工具），采用手风琴展开模式，切换 tab 时自动展开目标分组 (关联方案ID: DESIGN-20260806-005)
- [修改] `app/globals.css` 新增 `.nav-divider`、`.nav-group`、`.nav-group-header`、`.nav-group-label`、`.nav-group-count`、`.nav-group-chevron`、`.nav-group-items` 等二级菜单样式，新增精简模式适配样式 (关联方案ID: DESIGN-20260806-005)

#### 影响范围
- 仅影响管理后台侧边栏导航结构，不影响面板渲染逻辑、用户端界面、API、数据库和提示词生成流程

### 一键测试所有模型可用性 (DESIGN-20260806-004)

#### 新增
- [新增] `lib/server/provider-test.ts` Provider 测试逻辑模块，按 baseUrl 分流构造最小化测试请求（省略图片数据 + max_tokens=1），判定 API 可用性 (关联方案ID: DESIGN-20260806-004)
- [新增] `app/api/admin/provider-configs/test-all/route.ts` 并发测试所有 Provider 的 API 端点 (关联方案ID: DESIGN-20260806-004)
- [新增] `components/admin-console.tsx` 新增 `ProviderTestModal` 弹窗组件，以表格展示测试结果 (关联方案ID: DESIGN-20260806-004)
- [新增] `app/globals.css` 新增 `.provider-test-button`、`.provider-test-modal`、`.provider-test-table` 等样式 (关联方案ID: DESIGN-20260806-004)

#### 修改
- [修改] `components/admin-console.tsx` `ProviderManagerV3` 新增"一键测试所有模型"按钮和测试状态管理 (关联方案ID: DESIGN-20260806-004)

#### 文档
- [文档] `docs/API_REFERENCE.md` 新增 `POST /api/admin/provider-configs/test-all` 接口文档 (关联方案ID: DESIGN-20260806-004)

#### 影响范围
- 管理后台"模型 API"页面右上角新增测试按钮，不影响用户侧界面和生成流程

### 管理员分类属性配置与用户界面数据驱动 (DESIGN-20260806-003)

#### 新增
- [新增] `lib/types.ts` 新增 `PartCategoryConfigType` 联合类型（`brand_resource` / `resource` / `resource_subcategory`）、`SubcategoryGroupAsset` 类型、`SubcategoryGroup` 类型 (关联方案ID: DESIGN-20260806-003)
- [新增] `lib/part-category-aliases.ts` 新增 `defaultConfigTypeForCategory`、`defaultAssetImageVisibleForCategory`、`defaultSubcategoryConfigForCategory` 三个默认值函数，含排气 5 个布局组默认数据 (关联方案ID: DESIGN-20260806-003)
- [新增] `components/admin-console.tsx` 新增 `SubcategoryConfigEditor` 子组件，支持细分类分组的增删改排序及组内关联配件的增删改 (关联方案ID: DESIGN-20260806-003)
- [新增] `app/globals.css` 新增 `.config-type-badge`、`.subcategory-config-editor`、`.subcategory-group-card` 等管理端样式 (关联方案ID: DESIGN-20260806-003)

#### 修改
- [修改] `lib/server/db.ts` `asset_categories` 表新增 `config_type`、`asset_image_visible`、`subcategory_config_json` 三列，含迁移函数与数据填充；`mapCategoryRow`/`createCategory`/`updateCategory`/`seedCategory` 读写新字段 (关联方案ID: DESIGN-20260806-003)
- [修改] `lib/catalog.ts` `categoriesSeed` 派生逻辑新增 configType/assetImageVisible/subcategoryConfig 默认值 (关联方案ID: DESIGN-20260806-003)
- [修改] `app/api/admin/categories/route.ts` POST 处理器新增解析 configType/assetImageVisible/subcategoryConfig (关联方案ID: DESIGN-20260806-003)
- [修改] `app/api/admin/categories/[id]/route.ts` PATCH 处理器新增解析 configType/assetImageVisible/subcategoryConfig (关联方案ID: DESIGN-20260806-003)
- [修改] `components/admin-console.tsx` categoryForm 扩展三个新字段；新增配置类型下拉框、是否显示图片子设置；品牌管理/配件管理面板按 configType 条件渲染；类型列表添加配置类型徽章 (关联方案ID: DESIGN-20260806-003)
- [修改] `components/car-mod-studio.tsx` 移除 `brandFilteredCategoryIds`/`installToggleSurfaceCategoryIds`/`fixedStyleSurfaceAssetIds`/`exhaustLayoutGroups`/`exhaustLayoutLabelsById` 硬编码常量，替换为 configType/assetImageVisible/subcategoryConfig 数据驱动逻辑；`ExhaustLayoutList` 组件接收 `layoutGroups`/`layoutLabels` props (关联方案ID: DESIGN-20260806-003)
- [修改] `components/mobile/mobile-studio-app.tsx` 同 PC 端替换策略，移除所有 `mobile*` 硬编码常量，替换为 configType 驱动逻辑 (关联方案ID: DESIGN-20260806-003)

#### 文档
- [文档] `docs/DB_SCHEMA.md` 更新 `asset_categories` 表字段说明，新增三列 (关联方案ID: DESIGN-20260806-003)
- [文档] `docs/API_REFERENCE.md` 更新管理端分类 CRUD 接口字段说明及目录 API 响应字段 (关联方案ID: DESIGN-20260806-003)
- [文档] `docs/BUSINESS_DOMAIN.md` 更新术语表"配件分类"条目，补充配置类型概念 (关联方案ID: DESIGN-20260806-003)

#### 影响范围
- 管理端类型管理表单新增"配置类型"属性（品牌-资源/资源/资源-细分类），不同类型显示不同配置面板
- 管理端"资源"类型下可配置是否显示图片；"资源-细分类"类型下可配置细分类选项
- 用户端 PC/移动端渲染逻辑从硬编码 categoryId 集合改为 configType 数据驱动，视觉效果不变
- 排气布局组数据从硬编码改为从 `category.subcategoryConfig` 读取
- 生图 prompt 生成不受影响（提示词引擎不读取新字段）
- 用户操作习惯不变

## 2026-07-31

### PC端个人中心弹窗重构 (DESIGN-20260731-001)

#### 新增
- [新增] `components/pc-account-panel.tsx` PC 端个人中心弹窗主组件，实现左侧菜单（账户/订阅/订单）+ 右侧内容区分栏布局，内含账户页（头像选择、昵称/邮箱行内编辑保存、手机号验证码换绑含60s冷却、更改密码按钮）、订阅页（顶部额度卡片+套餐选择+支付方式子弹窗）、订单页（懒加载订单表格）、头像选择子弹窗、密码修改子弹窗（支持未设置密码场景提示） (关联方案ID: DESIGN-20260731-001)
- [新增] `lib/use-subscription-plans.ts` 套餐列表请求自定义 hook，封装 `GET /api/billing/plans` 请求与排序逻辑 (关联方案ID: DESIGN-20260731-001)
- [新增] `lib/subscription-checkout.ts` 订阅支付完成两步 API（checkout + mock-paid）封装模块 (关联方案ID: DESIGN-20260731-001)
- [新增] `lib/subscription-display.ts` 套餐展示辅助函数模块（planDisplayName、planFeatures、formatPlanPrice），从 subscribe-modal.tsx 迁移 (关联方案ID: DESIGN-20260731-001)
- [新增] `app/globals.css` 新增 `.pc-account-panel` 及相关样式（弹窗布局、侧边栏菜单、内容区、账户页表单、订阅套餐卡片、订单表格、头像/密码子弹窗），圆角与尺寸对齐 demo2，颜色使用 CSS 变量 (关联方案ID: DESIGN-20260731-001)

#### 修改
- [修改] `components/car-mod-studio.tsx` 移除内联 `DesktopAccountPanel` 实现（约450行），引入 `PcAccountPanel` 组件；移除 Header 中"会员"按钮及相关 `subscribeOpen` state 与 `SubscribeModal` PC 端挂载 (关联方案ID: DESIGN-20260731-001)
- [修改] `components/subscribe-modal.tsx` 套餐展示辅助函数与支付逻辑改为从 `lib/subscription-display`、`lib/subscription-checkout`、`lib/use-subscription-plans` 导入，减少自身代码量 (关联方案ID: DESIGN-20260731-001)
- [修改] `lib/types.ts` `AuthUser` 类型新增 `hasPassword: boolean` 字段，表示用户是否已设置密码 (关联方案ID: DESIGN-20260731-001)
- [修改] `lib/server/db.ts` `mapAuthUser` 函数新增 `hasPassword` 字段映射（基于 `password_hash` 是否为空）；`changeUserPassword` 函数当 `password_hash` 为空串时跳过 `verifyPassword` 校验，支持无密码用户首次设置密码 (关联方案ID: DESIGN-20260731-001)

#### 文档
- [文档] `docs/API_REFERENCE.md` 更新 `GET /api/auth/me` 响应示例新增 `hasPassword` 字段；更新 `POST /api/auth/password` 描述及参数说明，记录未设置密码时可传空 currentPassword 的行为变更 (关联方案ID: DESIGN-20260731-001)

#### 影响范围
- PC 端个人中心弹窗由单面板 Tab 布局重构为左菜单+右内容区分栏布局，整合账户/订阅/订单三大模块
- 主界面 Header 移除独立"会员"按钮，订阅入口统一收归个人中心弹窗
- `AuthUser` 类型新增 `hasPassword` 字段，`/api/auth/me` 响应自动携带
- `/api/auth/password` 接口行为增强：未设置密码用户可首次设置密码（currentPassword 传空）
- 移动端订阅流程不受影响（共享逻辑抽取后签名一致）

## 2026-07-30

### 移动端个人中心套餐按钮与额度展示重构 (DESIGN-20260730-006)

#### 修改
- [修改] `components/mobile/mobile-studio-app.tsx` `MobileProfilePage` 组件卡片头部按钮由"编辑资料"改为显示当前套餐小写 id（`planIdDisplay`，取值 `billing?.plan.id || authUser?.plan || "guest"`），点击行为由 `openProfileSection("profile")` 改为 `openSubscribe`；操作区两个按钮由可点击 button 改为只读 span，左按钮显示生成额度（`生成 X`/`Gen X`），右按钮显示对话额度（`对话 Y`/`Chat Y`）；删除不再使用的 `planName` 变量 (关联方案ID: DESIGN-20260730-006)
- [修改] `app/globals.css` `.mobile-profile-card-actions` 选择器新增 `.mobile-profile-card-action-readonly` 只读 span 样式（`cursor: default`、`user-select: none`），同步 light 主题选择器 (关联方案ID: DESIGN-20260730-006)

#### 影响范围
- 编辑资料入口改为头像点击进入（原头部按钮已改为套餐入口）
- 订阅弹窗改由头部套餐按钮触发（原左操作按钮已改为只读额度展示）
- 纯展示层调整，不涉及 API、数据库或业务逻辑变更

### 移动端个人中心顶栏微调 (free-task)

#### 修改
- [修改] `components/mobile/mobile-studio-app.tsx` `MobileProfilePage` 组件 topbar 移除"个人中心"标题文字，返回按钮图标由 22px 缩小至 18px
- [修改] `app/globals.css` `.mobile-profile-topbar button` 尺寸由 48px 缩小至 36px、圆角由 18px 调整为 12px，`.mobile-profile-topbar` 新增 `margin-bottom: 20px` 增加与下方卡片区域的间距

### 移动端个人中心按钮与列表调整 (DESIGN-20260730-005)

#### 修改
- [修改] `components/mobile/mobile-studio-app.tsx` `MobileProfilePage` 组件卡片左操作按钮文案由"订阅套餐"改为动态显示当前套餐名称（`planName`），右操作按钮文案由"我的订单"改为显示生成与对话剩余额度，图标由 `Receipt` 改为 `Zap`，点击行为由 `openOrders` 改为 `openSubscribe` (关联方案ID: DESIGN-20260730-005)
- [修改] `components/mobile/mobile-studio-app.tsx` `MobileProfilePage` 组件简单列表移除"编辑资料"和"订阅与套餐"两个行项，精简为 5 项（消息通知 → 换绑手机号 → 修改密码 → 我的订单 → 退出账号） (关联方案ID: DESIGN-20260730-005)
- [修改] `components/mobile/mobile-studio-app.tsx` 新增 `configBalance`/`chatBalance` 局部变量复用 `formatMobileProfileBalance` 计算额度文本，移除不再使用的 `Receipt` 图标导入 (关联方案ID: DESIGN-20260730-005)
- [修改] `app/globals.css` `.mobile-profile-card-actions button` 规则补充 `min-width: 0`、`white-space: nowrap`、`overflow: hidden` 防止额度文案溢出 (关联方案ID: DESIGN-20260730-005)

### 移动端个人中心编辑子页面重构 (DESIGN-20260730-004)

#### 重构
- [重构] `components/mobile/mobile-studio-app.tsx` 重构编辑资料、换绑手机号、修改密码三个子页面的表单 JSX：移除 label 标签改用 placeholder、新增 renderInput 辅助函数封装输入框与清除按钮、提交按钮改为药丸形、renderProfileEditorShell 新增副标题引导、头像选择器移除 legend (关联方案ID: DESIGN-20260730-004)
- [重构] `app/globals.css` 重构 `.mobile-profile-editor` 相关样式：移除表单卡片边框、输入框改为深色卡片样式（14px 圆角）、新增 `.mobile-profile-input-wrap`/`.mobile-profile-clear-btn`/`.mobile-profile-code-wrap`/`.mobile-profile-code-send`/`.mobile-profile-submit-btn`/`.mobile-profile-subtitle` 样式类、提交按钮改为药丸形（`--m-cyan` 背景）、状态反馈简化为纯文字+图标 (关联方案ID: DESIGN-20260730-004)

#### 修改
- [修改] `components/mobile/mobile-studio-app.tsx` 新增 `AlertCircle`、`Check` 图标导入，移除不再使用的 `Save` 图标导入 (关联方案ID: DESIGN-20260730-004)

### 移除管理员生成记录手动重试功能 (DESIGN-20260730-002)

#### 修改
- [修改] `components/admin/generation-detail.tsx` 移除重试按钮、重试状态管理、重试次数/父任务/子任务展示、RetryChildrenTable 组件 (关联方案ID: DESIGN-20260730-002)
- [修改] `components/admin-console.tsx` 移除失败样本列表中重试次数的文本展示 (关联方案ID: DESIGN-20260730-002)
- [修改] `lib/types.ts` 从 `GenerationDetailResponse` 移除 `retryCount`、`retryParentId`、`retryChildren` 字段，从 `AdminGenerationFailure` 移除 `retryCount` 字段 (关联方案ID: DESIGN-20260730-002)
- [修改] `lib/server/db.ts` `getGenerationDetail` 函数移除重试子任务查询逻辑及返回字段 (关联方案ID: DESIGN-20260730-002)

#### 删除
- [删除] `app/api/admin/generations/[id]/retry/route.ts` 删除管理员手动重试 API 接口 (关联方案ID: DESIGN-20260730-002)

#### 文档
- [文档] `docs/API_REFERENCE.md` 移除重试生成任务接口文档，更新详情/列表接口响应示例移除重试相关字段 (关联方案ID: DESIGN-20260730-002)

### 运营需求剩余功能补全 (DESIGN-20260730-001)

#### 新增
- [新增] `lib/server/analytics-queries.ts` 新增 `getFailureAttribution`、`getSuccessRateSeries`、`getLatencyPercentiles`、`getQueueStatus`、`getQualityScoreTrend`、`getBadCaseEfficiency`、`getReportMetrics` 查询函数 (关联方案ID: DESIGN-20260730-001)
- [新增] `lib/types.ts` 新增失败归因、健康监控、质量分析、消息广播、报表生成等类型定义 (关联方案ID: DESIGN-20260730-001)
- [新增] `app/api/admin/analytics/failures/attribution/route.ts` 失败归因分析 API (关联方案ID: DESIGN-20260730-001)
- [新增] `app/api/admin/analytics/health/success-rate/route.ts` API 成功率监控 API (关联方案ID: DESIGN-20260730-001)
- [新增] `app/api/admin/analytics/health/latency/route.ts` 响应时间监控 API (关联方案ID: DESIGN-20260730-001)
- [新增] `app/api/admin/analytics/health/queue/route.ts` 队列积压监控 API (关联方案ID: DESIGN-20260730-001)
- [新增] `app/api/admin/analytics/quality/score-trend/route.ts` 质量评分趋势 API (关联方案ID: DESIGN-20260730-001)
- [新增] `app/api/admin/analytics/quality/bad-cases/route.ts` Bad Case 处理效率 API (关联方案ID: DESIGN-20260730-001)
- [新增] `app/api/admin/messages/broadcast/route.ts` 用户消息广播 API (关联方案ID: DESIGN-20260730-001)
- [新增] `app/api/admin/reports/generate/route.ts` 数据报表导出 API (关联方案ID: DESIGN-20260730-001)
- [新增] `components/admin/health-analytics.tsx` 系统健康监控组件 (关联方案ID: DESIGN-20260730-001)
- [新增] `components/admin/quality-analytics.tsx` 内容质量分析组件 (关联方案ID: DESIGN-20260730-001)
- [新增] `components/admin/message-broadcaster.tsx` 消息推送组件 (关联方案ID: DESIGN-20260730-001)
- [新增] `components/admin/report-generator.tsx` 报表生成组件 (关联方案ID: DESIGN-20260730-001)

#### 修改
- [修改] `components/admin/failure-analytics.tsx` 新增归因饼图展示，集成 `DonutChartCard` (关联方案ID: DESIGN-20260730-001)
- [修改] `components/admin-console.tsx` 新增"系统健康"、"质量分析"、"消息推送"、"报表导出"四个 Tab 及导航项 (关联方案ID: DESIGN-20260730-001)

#### 文档
- [文档] `docs/API_REFERENCE.md` 新增 8 个运营分析 API 接口文档 (关联方案ID: DESIGN-20260730-001)

#### 影响范围
- 管理后台新增"系统健康"、"质量分析"、"消息推送"、"报表导出"四个页面
- 新增 8 个管理端 API 端点
- 所有功能基于现有数据表，无需新增表或字段

---

## 2026-07-29

### 缺陷修复 — 管理员"用户详情"页面审计日志渲染异常

#### 修复
- [修复] `lib/server/db.ts` `getUserDetail` 函数审计日志映射与 `AuditLog` 类型不一致：`metadata` 由 `safeJson` 解析的对象改为字符串、字段名 `actorId` 改为 `userId`、移除 `as unknown as` 强制断言
- [修复] `components/admin/user-detail.tsx` `formatMetadata` 函数补充防御性逻辑，参数类型放宽为 `unknown`，对象类型直接 `JSON.stringify` 避免白屏

### 运营分析平台（阶段四至六）— 失败分析、成本核算、订单分析、额度监控 (DESIGN-20260729-003)

#### 新增
- [新增] `lib/server/alert-scanner.ts` 异常检测扫描模块，支持高频生成和高成本告警检测 (关联方案ID: DESIGN-20260729-003)
- [新增] `lib/types.ts` 新增失败分析、成本分析、订单分析、额度监控、告警记录等类型定义 (关联方案ID: DESIGN-20260729-003)
- [新增] `lib/server/analytics-queries.ts` 新增 `getTimeSeriesSum`、`getFailureRateSeries`、`getCostDistribution` 查询函数 (关联方案ID: DESIGN-20260729-003)
- [新增] `lib/server/db.ts` 新增 `alert_records` 表及 3 个索引 (关联方案ID: DESIGN-20260729-003)
- [新增] `lib/server/db.ts` 新增 `getProviderFailureRanking`、`getCostByUser`、`getCostByCategory`、`getRevenueStats`、`getOrderConversionStats`、`getRenewalRate`、`getBalanceDistribution`、`listAlerts`、`updateAlertStatus`、`insertAlert` 数据库函数 (关联方案ID: DESIGN-20260729-003)
- [新增] `app/api/admin/analytics/failures/trend/route.ts` 失败率趋势 API (关联方案ID: DESIGN-20260729-003)
- [新增] `app/api/admin/analytics/failures/provider-ranking/route.ts` Provider 失败率排名 API (关联方案ID: DESIGN-20260729-003)
- [新增] `app/api/admin/analytics/costs/trend/route.ts` 成本趋势 API (关联方案ID: DESIGN-20260729-003)
- [新增] `app/api/admin/analytics/costs/by-user/route.ts` 按用户成本排名 API (关联方案ID: DESIGN-20260729-003)
- [新增] `app/api/admin/analytics/costs/by-category/route.ts` 按配件类别成本 API (关联方案ID: DESIGN-20260729-003)
- [新增] `app/api/admin/analytics/costs/distribution/route.ts` 单次生成成本分布 API (关联方案ID: DESIGN-20260729-003)
- [新增] `app/api/admin/analytics/orders/revenue-trend/route.ts` 收入趋势 API (关联方案ID: DESIGN-20260729-003)
- [新增] `app/api/admin/analytics/orders/conversion/route.ts` 订单转化率 API (关联方案ID: DESIGN-20260729-003)
- [新增] `app/api/admin/analytics/orders/renewal/route.ts` 续费率 API (关联方案ID: DESIGN-20260729-003)
- [新增] `app/api/admin/analytics/quota/consumption-trend/route.ts` 额度消耗趋势 API (关联方案ID: DESIGN-20260729-003)
- [新增] `app/api/admin/analytics/quota/balance-distribution/route.ts` 额度余额分布 API (关联方案ID: DESIGN-20260729-003)
- [新增] `app/api/admin/analytics/alerts/route.ts` 告警列表 API (关联方案ID: DESIGN-20260729-003)
- [新增] `app/api/admin/analytics/alerts/[id]/route.ts` 更新告警状态 API (关联方案ID: DESIGN-20260729-003)
- [新增] `components/admin/failure-analytics.tsx` 失败分析组件 (关联方案ID: DESIGN-20260729-003)
- [新增] `components/admin/cost-analytics.tsx` 成本分析组件 (关联方案ID: DESIGN-20260729-003)
- [新增] `components/admin/order-analytics.tsx` 订单分析组件 (关联方案ID: DESIGN-20260729-003)
- [新增] `components/admin/quota-analytics.tsx` 额度监控组件 (关联方案ID: DESIGN-20260729-003)

#### 修改
- [修改] `components/admin-console.tsx` 新增"失败分析"、"成本分析"、"订单分析"、"额度监控"四个 Tab 及导航项 (关联方案ID: DESIGN-20260729-003)
- [修改] `app/globals.css` 新增分析页面容器、工具栏、异常横幅、原因关键词列表、告警表格等 CSS 样式 (关联方案ID: DESIGN-20260729-003)

#### 文档
- [文档] `docs/API_REFERENCE.md` 新增 13 个运营分析 API 接口文档 (关联方案ID: DESIGN-20260729-003)
- [文档] `docs/DB_SCHEMA.md` 新增 alert_records 表结构文档 (关联方案ID: DESIGN-20260729-003)
- [文档] `docs/ARCHITECTURE.md` 新增 ADR-0006 异常检测与告警持久化方案，更新核心模块表 (关联方案ID: DESIGN-20260729-003)
- [文档] `docs/BUSINESS_DOMAIN.md` 新增失败率/成本/ARPU/转化率/续费率/额度余额/告警记录等术语，新增 BR-013 至 BR-017 业务规则 (关联方案ID: DESIGN-20260729-003)

#### 影响范围
- 管理后台新增"失败分析"、"成本分析"、"订单分析"、"额度监控"四个分析页面
- 数据库新增 alert_records 表（23 张表）
- 新增 13 个管理端 API 端点

---

### 运营分析平台（阶段一至三）— 时序聚合基础设施、生成记录分析、用户洞察 (DESIGN-20260729-002)

#### 新增
- [新增] `lib/server/analytics-queries.ts` 时序聚合查询模块，支持按小时/天/周/月分桶的时间序列查询
- [新增] `lib/server/export-service.ts` 通用 CSV 导出服务
- [新增] `app/api/admin/generation-records/route.ts` 生成记录分页筛选 API
- [新增] `app/api/admin/generation-records/[id]/route.ts` 生成记录详情 API
- [新增] `app/api/admin/generation-records/[id]/retry/route.ts` 生成记录重试 API
- [新增] `app/api/admin/generation-records/export/route.ts` 生成记录导出 API
- [新增] `app/api/admin/analytics/generation-trend/route.ts` 生成量趋势 API
- [新增] `app/api/admin/analytics/user-registration-trend/route.ts` 用户注册趋势 API
- [新增] `app/api/admin/analytics/user-activity/route.ts` 用户活跃度 API
- [新增] `app/api/admin/analytics/user-retention/route.ts` 用户留存率 API
- [新增] `app/api/admin/users/active/route.ts` 活跃用户列表 API
- [新增] `app/api/admin/users/[id]/route.ts` 用户详情 API
- [新增] `app/api/admin/users/[id]/tags/route.ts` 用户标签更新 API
- [新增] `app/api/admin/users/export/route.ts` 用户导出 API
- [新增] `components/admin/analytics-charts.tsx` 管理后台图表组件
- [新增] `components/admin/generation-records.tsx` 生成记录列表组件
- [新增] `components/admin/generation-detail.tsx` 生成记录详情组件
- [新增] `components/admin/user-analytics.tsx` 用户分析组件
- [新增] `components/admin/user-detail.tsx` 用户详情组件
- [新增] Recharts 图表库依赖

#### 修改
- [修改] `components/admin-console.tsx` 集成"生成记录"和"用户分析"两个新 Tab，支持详情视图切换逻辑
- [修改] `app/globals.css` 新增运营分析页面 CSS 样式
- [修改] `lib/server/db.ts` users 表新增 `tags_json` 字段存储手动标签

#### 影响范围
- 管理后台新增"生成记录"和"用户分析"两个 Tab，支持详情视图切换

---

### 新增
- [新增] `app/api/billing/orders/route.ts` 用户查询自己的支付订单列表 API (关联方案ID: DESIGN-20260729-001)
- [新增] `app/api/admin/orders/route.ts` 管理员查询所有订单 API，支持按时间范围、用户（模糊匹配）、套餐筛选 (关联方案ID: DESIGN-20260729-001)
- [新增] `lib/account-client.ts` 新增 `getAccountOrders()` 客户端方法 (关联方案ID: DESIGN-20260729-001)
- [新增] `lib/types.ts` 新增 `AdminPaymentOrder` 类型，`PaymentOrder` 类型新增 `refunded` 状态 (关联方案ID: DESIGN-20260729-001)
- [新增] `components/admin-console.tsx` 管理后台新增"订单"tab，包含筛选栏（时间范围、用户、套餐）和订单表格 (关联方案ID: DESIGN-20260729-001)
- [新增] `components/car-mod-studio.tsx` PC 端个人中心新增"我的订单"tab 和订单列表视图 (关联方案ID: DESIGN-20260729-001)
- [新增] `components/mobile/mobile-studio-app.tsx` 移动端个人中心新增"我的订单"入口和订单列表子页面 (关联方案ID: DESIGN-20260729-001)
- [新增] `app/globals.css` 新增 PC 端订单表格、移动端订单卡片、管理后台订单筛选栏和表格样式 (关联方案ID: DESIGN-20260729-001)

### 修改
- [修改] `app/api/billing/checkout/route.ts` 移除 403 禁用逻辑，恢复创建支付订单流程 (关联方案ID: DESIGN-20260729-001)
- [修改] `app/api/billing/mock-paid/route.ts` 移除 403 禁用逻辑，恢复模拟支付完成流程 (关联方案ID: DESIGN-20260729-001)
- [修改] `lib/server/db.ts` 导出 `getPaymentOrders(userId)` 函数，新增 `getAllPaymentOrders(filters)` 函数（JOIN users 表获取用户信息） (关联方案ID: DESIGN-20260729-001)
- [修改] `components/subscribe-modal.tsx` 启用支付流程，免费版按钮 disabled，付费版点击直接串行调用 checkout + mock-paid 完成订阅 (关联方案ID: DESIGN-20260729-001)

### 文档
- [文档] `docs/API_REFERENCE.md` 更新 checkout/mock-paid 接口描述（移除禁用说明），新增 `GET /api/billing/orders` 和 `GET /api/admin/orders` 接口文档 (关联方案ID: DESIGN-20260729-001)
- [文档] `docs/DB_SCHEMA.md` 修正 `payment_orders` 表字段描述（`amount` → `amount_cents`，删除不存在的 `paid_at`，补充 `method` 字段） (关联方案ID: DESIGN-20260729-001)
- [文档] `docs/CHANGELOG.md` 同步更新本次变更 (关联方案ID: DESIGN-20260729-001)

## 2026-07-28

### 修复
- [修复] `components/admin-console.tsx` 管理员登录 `sendAdminCode` 函数处理 API 返回的 `devCode` 字段：开发环境（mock 短信）自动回写验证码到输入框并提示"验证码已自动回写（开发模式）"；生产环境（真实短信）不自动回写，提示"管理员验证码已发送，请查收短信"
- [修复] `components/car-mod-studio.tsx` 将 PC 端浮动菜单（`.app-floating-rail` / `.app-floating-rail-collapsed`）从 `.studio-card` 内部移出至 `.app-shell` 直接子级，修复因 `.studio-card` 的 `backdrop-filter` 创建包含块导致 `position: fixed` 失效、菜单未贴浏览器窗口最左侧的问题 (关联方案ID: DESIGN-20260728-001)

### 修改
- [修改] `app/globals.css` `.app-floating-rail` 和 `.app-floating-rail-collapsed` 的 `left` 由 4px 改为 0，`border-radius` 由 12px 改为 0 12px 12px 0，`border-left: none`，`box-shadow` 由 `var(--shadow)` 改为 `var(--shadow-rail)`，实现菜单完全贴边窗口左侧 (关联方案ID: DESIGN-20260728-001)
- [修改] `app/globals.css` `:root` 新增 `--shadow-rail` 设计令牌（右侧定向阴影） (关联方案ID: DESIGN-20260728-001)

### 文档
- [文档] `docs/CHANGELOG.md` 同步更新本次变更 (关联方案ID: DESIGN-20260728-001)
- [文档] `docs/faq/errors.md` 新增 `position:fixed` 被 `backdrop-filter` 包含块影响的 FAQ 条目 (关联方案ID: DESIGN-20260728-001)

## 2026-07-27

### 修改
- [修改] `components/car-mod-studio.tsx` PC 端浮动菜单新增折叠/展开功能：菜单紧贴窗口左侧（left: 4px），底部追加"<"折叠按钮，点击后隐藏菜单仅保留">"展开按钮 (关联方案ID: DESIGN-20260727-002)
- [修改] `app/globals.css` `.app-floating-rail` left 由 12px 调整为 4px；新增 `.app-floating-rail-collapsed` 折叠态容器样式及 `.app-rail-collapse` 折叠按钮分隔线样式 (关联方案ID: DESIGN-20260727-002)
- [修改] `components/car-mod-studio.tsx` `components/mobile/mobile-studio-app.tsx` 移除改图界面"原图/生成图/对比"三页签切换栏，仅保留对比视图；有生成结果时显示对比滑块，有原图无生成时显示空状态占位 (关联方案ID: DESIGN-20260727-001)
- [修改] `components/car-mod-studio.tsx` 新增生成完成时自动递增 compareKey 触发对比滑块重播动画 (关联方案ID: DESIGN-20260727-001)
- [修改] `components/mobile/mobile-studio-app.tsx` 移除对话模式 MobileScreenHead 左侧历史侧栏按钮，会话列表嵌入左上角菜单抽屉 (关联方案ID: DESIGN-20260727-001)
- [修改] `components/mobile/mobile-studio-app.tsx` `components/chat-mode.tsx` 菜单抽屉布局由 2×2 改为单列，对话模式下在子菜单下方直接嵌入聊天会话列表 (关联方案ID: DESIGN-20260727-001)
- [修改] `app/globals.css` 移动端对比滑块图层使用 object-fit: cover 确保两图尺寸完全一致 (关联方案ID: DESIGN-20260727-001)
- [修复] `components/chat-mode.tsx` 使用 ref 持有 selectSession 引用消除 useEffect 依赖警告，修复 ESLint react-hooks/exhaustive-deps (关联方案ID: DESIGN-20260727-001)
- [清理] `app/globals.css` 移除不再使用的 .mobile-chat-sidebar-toggle 相关样式 (关联方案ID: DESIGN-20260727-001)
- [修复] `components/car-mod-studio.tsx` 将 job 状态监听 useEffect 移至 job 变量声明之后，修复 "ReferenceError: Cannot access 'job' before initialization" 启动崩溃 (关联方案ID: DESIGN-20260727-001)
- [修改] `components/mobile/mobile-studio-app.tsx` 配置模式下左上角菜单抽屉新增生成历史列表，点击历史记录切换到对应生成结果 (关联方案ID: DESIGN-20260727-001)
- [修改] `components/mobile/mobile-studio-app.tsx` 移除用户中心"生成历史"子页面入口，历史记录统一通过左上角菜单抽屉访问 (关联方案ID: DESIGN-20260727-001)
- [修改] `app/globals.css` 新增 .mobile-menu-history-list / .mobile-menu-history-item 等生成历史列表样式 (关联方案ID: DESIGN-20260727-001)

### 文档
- [文档] `docs/CHANGELOG.md` 同步更新本次变更 (关联方案ID: DESIGN-20260727-001)

> 最后更新时间：2026-07-31
> 关联方案ID：DESIGN-20260731-001

## v0.1.5 - 2026-07-26

### 修改
- [修改] app/globals.css `.compare-slider-before` 的 `clip-path` 由 `inset(0 calc(100% - var(--slider-position)) 0 0)` 改为 `inset(0 0 0 var(--slider-position))`，原图层由分隔线左侧裁剪改为右侧裁剪，使从左向右滑动呈"原图 → 生成图"过渡 (关联方案ID: DESIGN-20260726-001)
- [修改] components/image-comparison-slider.tsx 同步更新 Props 与裁剪方向相关注释，描述原图显示在分隔线右侧、从左向右滑动由原图过渡为生成图 (关联方案ID: DESIGN-20260726-001)

## v0.1.4 - 2026-07-25

### 新增
- [新增] 应用菜单导航系统（关联方案ID: DESIGN-20260725-003）
  - PC 端：左侧浮动垂直菜单栏（改图/生图/视频/特效），仅图标显示，hover 显示 tooltip，当前激活项高亮，未实现功能点击后显示"即将上线"占位
  - 移动端：全屏抽屉菜单（MobileMenuDrawer），由顶部栏左上角按钮触发，framer-motion 滑入动画，未实现功能点击显示"即将上线"
  - 移动端 chat 模式：聊天侧栏入口从顶部栏迁移至聊天界面内部（MobileChatMode 的 MobileScreenHead 区域左侧）
  - 移动端用户中心：新增"生成历史"子页面（复用 MobileHistorySheet），位于"编辑资料"上方
  - AppMenu 类型定义（"edit" | "generate" | "video" | "effect"），activeMenu 状态管理
- [新增] ComingSoonPlaceholder 占位组件，未实现功能点击后界面中心显示"即将上线"提示 (关联方案ID: DESIGN-20260725-003)

### 修改
- [修改] components/car-mod-studio.tsx 新增 AppMenu 类型、activeMenu state、PC 浮动垂直菜单栏、ComingSoonPlaceholder 渲染逻辑 (关联方案ID: DESIGN-20260725-003)
- [修改] components/mobile/mobile-studio-app.tsx 新增 MobileMenuDrawer 组件、菜单按钮行为变更、chat 模式内嵌侧栏按钮、用户中心历史子页面 (关联方案ID: DESIGN-20260725-003)
- [修改] app/globals.css 新增 .app-floating-rail / .app-rail-item / .coming-soon-overlay / .mobile-menu-drawer* / .chat-sidebar-trigger / .history-sheet-page 等样式 (关联方案ID: DESIGN-20260725-003)

### 文档
- [文档] docs/ARCHITECTURE.md 展示层追加菜单导航系统组件说明 (关联方案ID: DESIGN-20260725-003)

## v0.1.3 - 2026-07-25

### 修改
- [修改] components/image-comparison-slider.tsx 新增 autoPlay prop，开启后组件挂载时自动从 0%（全原图）动画到 100%（全生成图），时长 1.5 秒；用户拖动或键盘操作立即中断自动播放 (关联方案ID: DESIGN-20260725-003)
- [修改] components/car-mod-studio.tsx 新增 compareKey state，每次切换到对比视图时递增以重新挂载滑块并触发自动播放；setViewMode 替换为 setViewModeWithCompareReset 封装 (关联方案ID: DESIGN-20260725-003)
- [修改] components/mobile/mobile-studio-app.tsx 新增 compareKey prop 接收桌面端传递的重置 key，对比视图滑块自动播放 (关联方案ID: DESIGN-20260725-003)

### 文档
- [文档] docs/AGENTS.md 自定义组件表 ImageComparisonSlider 追加 autoPlay / compareKey 说明 (关联方案ID: DESIGN-20260725-003)

## v0.1.2 - 2026-07-25

### 新增
- [新增] components/image-comparison-slider.tsx 重叠对比滑块组件，原图与生成图同位置重叠，拖动中间手柄通过 clip-path 控制两侧显示比例，支持指针拖动/触摸/键盘 (关联方案ID: DESIGN-20260725-002)

### 修改
- [修改] components/car-mod-studio.tsx 桌面端对比视图由左右双格 compare-grid 改为重叠滑块组件；对比模式导出改为仅下载生成图（文件名 ai-mod-result-*） (关联方案ID: DESIGN-20260725-002)
- [修改] components/mobile/mobile-studio-app.tsx 移动端对比视图由上下堆叠 mobile-compare-grid 改为同一重叠滑块组件 (关联方案ID: DESIGN-20260725-002)
- [修改] app/globals.css 新增 .compare-slider* 系列样式（引用设计令牌），删除旧 .compare-grid 与 .mobile-compare-grid 规则 (关联方案ID: DESIGN-20260725-002)

### 废弃
- [废弃] lib/client/image-download.ts 移除 downloadCompareImage 函数及其私有辅助函数（loadImageElement/imageAspectRatio/drawContainedImage/canvasToBlob），对比导出不再合成堆叠图 (关联方案ID: DESIGN-20260725-002)

### 文档
- [文档] docs/AGENTS.md 自定义组件表追加 ImageComparisonSlider (关联方案ID: DESIGN-20260725-002)

## v0.1.1 - 2026-07-25

### 新增
- [新增] components/car-mod-studio.tsx 配置模式"生成"按钮上方添加 Dry run 复选框，支持不调用生图 API 调试配置流程 (关联方案ID: DESIGN-20260725-001)
- [新增] app/api/generations/route.ts 配置模式生成接口支持 dryRun 参数，开启时不扣费、不调生图 API，返回 prompt 预览 (关联方案ID: DESIGN-20260725-001)

### 文档
- [文档] docs/API_REFERENCE.md 配置模式生成接口新增 dryRun 参数及 Dry run 响应格式说明 (关联方案ID: DESIGN-20260725-001)

## v0.1.0 - 2026-07-25

### 新增
- [新增] app/page.tsx 前台首页，渲染 CarModStudio 核心组件
- [新增] app/admin/page.tsx 管理后台页面，渲染 AdminConsole 组件
- [新增] components/car-mod-studio.tsx 核心改车工作室组件，支持配置模式（自选配件）和聊天模式（自然语言描述）
- [新增] components/chat-mode.tsx 对话模式组件，支持自然语言改装需求描述
- [新增] components/auth-modal.tsx 全屏认证弹窗，支持一键登录/短信验证码/密码登录
- [新增] components/subscribe-modal.tsx 会员订阅弹窗
- [新增] components/admin-console.tsx 管理后台（13 个功能模块：数据看板/资源库/头像/Provider/提示词/工作流/风控/会员/用量/BadCase/用户/画像/审计）
- [新增] components/workflow-designer.tsx 可视化工作流设计器
- [新增] components/mobile/mobile-studio-app.tsx 移动端工作室
- [新增] app/api/auth/ 认证模块（登录/注册/登出/密码修改/手机换绑/重置密码/一键登录/验证码发送）
- [新增] app/api/billing/ 计费模块（套餐查询/计费状态/结账/模拟支付）
- [新增] app/api/chat/ 聊天模块（消息处理/会话管理/推荐提示词）
- [新增] app/api/garage/ 车库模块（生成历史/收藏/删除）
- [新增] app/api/generations/ 配置模式生成接口
- [新增] app/api/catalog/ 完整目录数据接口
- [新增] app/api/admin/ 管理后台 API（资源/品牌/分类/头像/车漆/护栏/套餐/Provider/配额/上传/用户/工作流/提示词）
- [新增] app/api/account/ 账户模块（头像预设/消息/已读标记）
- [新增] app/api/vehicle-recognition/ 车辆识别接口
- [新增] app/api/proxy-image/ 图片代理接口
- [新增] app/api/download-image/ 图片下载接口
- [新增] lib/server/db.ts SQLite 数据库模块（22 张表，WAL 模式，AES-256-CBC 加密）
- [新增] lib/server/auth.ts Cookie-based Session 认证
- [新增] lib/server/generation-engine.ts 16 步生成流水线引擎
- [新增] lib/server/generation-provider.ts 多 Provider 生图支持（OpenAI/fal.ai/302.ai/yunwu.ai）
- [新增] lib/server/vision-provider.ts 视觉识别（车辆/配件/结果检查）
- [新增] lib/server/llm-provider.ts LLM 意图解析
- [新增] lib/server/guardrail.ts 内容安全护栏
- [新增] lib/server/aliyun-pnvs.ts 阿里云短信/号码认证集成
- [新增] lib/server/progress-stream.ts NDJSON 流式进度协议
- [新增] lib/server/image-materializer.ts 图片物化持久化
- [新增] lib/server/local-images.ts 本地图片存储（data/ + public/ 双目录）
- [新增] lib/generation-core.ts 生成核心逻辑（StandardJson 构建/意图解析/提示词组装）
- [新增] lib/prompts.ts 提示词构建引擎（15 种模板作用域）
- [新增] lib/catalog.ts 目录种子数据（12 个配件分类、品牌、车漆、Provider、工作流）
- [新增] lib/types.ts 核心类型系统（约 700 行类型定义）
- [新增] config/prompt-packs/ 版本化提示词包（稳定版 effective-prompt-v1-2026-05-29）
- [新增] scripts/smoke.mjs 端到端冒烟测试
- [新增] scripts/start-next-dev.mjs 自定义开发服务器
- [新增] scripts/audit-project-state.mjs 项目状态审计
- [新增] data/part-reference-manifest.v1.json 配件参考图清单（18 组配件）
- [新增] public/assets/parts/references/ 配件参考图资源
- [新增] public/assets/parts/test-cases/ 配件测试用例图片
- [新增] skills/part-prompt-ops-chatgpt-web/ 配件提示词运营技能
- [新增] 三级会员体系（free: 725 积分/月, pro: 2210 积分/月, max: 6160 积分/月）

### 文档
- [文档] docs/DOCS-SPEC.md 文档体系元规范
- [文档] docs/README.md 项目说明
- [文档] docs/ARCHITECTURE.md 架构设计文档
- [文档] docs/BUSINESS_DOMAIN.md 业务领域文档
- [文档] docs/AGENTS.md AI Agent 规范
- [文档] docs/API_REFERENCE.md API 参考文档
- [文档] docs/DB_SCHEMA.md 数据库设计文档
- [文档] docs/CHANGELOG.md 变更日志

> 最后更新时间：2026-08-07

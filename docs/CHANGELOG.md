# 变更日志

所有条目按时间倒序排列，新条目置顶。

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

> 最后更新时间：2026-07-26

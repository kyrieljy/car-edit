# 变更日志

所有条目按时间倒序排列，新条目置顶。

## v0.2.0 - 2026-07-26

### 修改
- [修改] components/mobile/mobile-studio-app.tsx 移动端改图菜单模式切换隔离：`MobileStudioApp` 主 return 中 `mobile-shared-mode-bar`（MobileModeSwitch 配置/对话模式切换栏）与 `mobile-access-banner-layer`（MobileAccessBanner 登录/额度提示层）的渲染由无条件改为 `activeMenu === "edit"` 条件守卫包裹，使这两个区域仅在"改图"菜单下显示；非改图菜单（生图/视频/特效）下隐藏切换栏与提示层，`mobile-coming-soon` 成为唯一主内容；`appMode` 状态在菜单切换间保持不变，切回改图时无缝恢复原模式 (关联方案ID: DESIGN-20260726-008)
- [修改] app/globals.css `.mobile-coming-soon` 的 `min-height` 由 40vh 调整为 60vh，使"即将上线"占位在非改图菜单下（隐藏切换栏后）撑满更大区域，居中更聚焦 (关联方案ID: DESIGN-20260726-008)
- [修改] components/mobile/mobile-studio-app.tsx 移动端生成历史迁移至左上角菜单：删除个人信息页面 `mobile-profile-list` 中"生成历史"按钮，`MobileProfileSection` 类型移除 `"history"`，`renderEditor` 移除 `section === "history"` 分支，`MobileProfilePage` props 清理 history/job/selectHistoryJob/deleteHistoryJob/formatHistoryTitle 字段；`MobileMenuDrawer` 扩展 history/job/selectHistoryJob/deleteHistoryJob/formatHistoryTitle/t props，新增 `showGenHistory = appMode === "config"` 条件渲染分支；新增 `MobileMenuGenerationHistory` 组件，结构对齐 `MobileMenuChatHistory`（标题 + `chat-history-scroll` 滚动列表），复用 `MobileHistorySheet` 渲染生成历史列表，支持点击选中（关闭菜单并加载历史）、删除单条历史、空状态提示 (关联方案ID: DESIGN-20260726-007)
- [修改] app/globals.css 新增 `.mobile-menu-gen-history` 容器样式（对齐 `.mobile-menu-chat-history`）：内边距 0 20px 24px、标题区 flex 布局、标题文字 13px var(--muted)、滚动列表区 max-height 50vh overflow-y auto (关联方案ID: DESIGN-20260726-007)
- [修改] components/car-mod-studio.tsx PC 端改图界面页签简化：删除「原图/生成图/对比」三个页签切换按钮（`.view-switch` 容器）与 original/generated 渲染分支，对比滑块（ImageComparisonSlider）改为无条件渲染；无生成图时显示空状态提示引导用户先生成；viewMode 状态固定为 "compare"，清理 6 处 setViewMode 副作用调用（上传/生成开始/生成成功/选中历史/清空配置/删除历史）；saveResult 函数移除 exportMode 参数与分支判断，统一下载生成图；ResultPanel Props 移除 viewMode/setViewMode 字段；StudioCopy 新增 compareWaiting 文案 (关联方案ID: DESIGN-20260726-006)
- [修改] components/mobile/mobile-studio-app.tsx 移动端页签同步简化：删除 `.mobile-view-tabs` 三页签 UI 与 original/generated 渲染分支，简化 effectiveViewMode/canToggleMediaChrome/canUploadFromMedia 等变量为基于 hasGenerated 的判断；media card 渲染改为有原图+生成图显示对比滑块、有原图无生成图显示空状态、无原图显示上传占位；saveResult 调用简化 (关联方案ID: DESIGN-20260726-006)
- [修改] components/mobile/mobile-studio-app.tsx 移动端历史会话入口迁移：删除 MobileChatMode 中 MobileScreenHead 的 `mobile-chat-sidebar-toggle` 按钮（leftAction）；移除 chatSidebarOpen state 及相关 overlay 计算；MobileMenuDrawer 新增 appMode/chatHistoryApi props，当 appMode === "chat" 时在四子菜单下方渲染历史会话列表（MobileMenuChatHistory 组件），支持置顶/最近分组、点击选中、新建对话、置顶/删除操作，点击会话后关闭菜单抽屉 (关联方案ID: DESIGN-20260726-006)
- [修改] components/mobile/mobile-studio-app.tsx 四子菜单改单列：`.mobile-menu-grid` 从 2 列网格改为单列纵向排列，`.mobile-menu-card` 改为横向布局（图标+文字左右排列） (关联方案ID: DESIGN-20260726-006)
- [修改] components/chat-mode.tsx ChatMode 新增 onChatApiReady 可选回调：移动端场景下通过 useRef + useEffect 将 pinned/recent/activeSessionId 及会话操作函数暴露给父组件，PC 端行为完全不变（onChatApiReady 默认 undefined） (关联方案ID: DESIGN-20260726-006)
- [修改] app/globals.css PC 端弹窗亮色适配：个人中心弹窗（`.account-panel*` 系列）新增约 30 处 `[data-theme="light"]` 亮色覆盖规则，覆盖遮罩/主容器/头部/按钮/用户信息区/额度卡片/Tab 导航/表单/头像选择器/消息提示/空状态全部子区域，背景统一为 var(--surface)/var(--input-bg)，文字统一为 var(--text)/var(--muted)；会员弹窗（`.pricing-template*` 系列）补充容器层亮色覆盖 4 处：`.pricing-backdrop` 遮罩、`.subscribe-modal.pricing-template` 主容器、`.pricing-template-head h2` 标题、`.pricing-template-head small` 副标题 (关联方案ID: DESIGN-20260726-006)
- [修改] app/globals.css 页签与历史按钮 CSS 清理：删除 `.view-switch`/`.view-switch button`/`.view-switch button.selected`/`.view-switch button svg` 等规则（从选择器组中移除并删除独立规则）；删除 `.mobile-chat-sidebar-toggle` 及 `:active` 规则 (关联方案ID: DESIGN-20260726-006)

### 文档
- [文档] docs/ARCHITECTURE.md ADR-0005 影响字段补充 DESIGN-006 变更说明（改图页签简化、个人中心/会员弹窗亮色适配、移动端菜单重构与历史会话整合），关联方案ID 追加 DESIGN-20260726-006 (关联方案ID: DESIGN-20260726-006)

## v0.1.9 - 2026-07-26

### 修改
- [修改] app/globals.css 配置模式空状态亮色适配：`[data-theme="light"] .result-window` 背景由 var(--surface-3) 改为 var(--bg) 消除与周围 #f7f7f7 色差；新增 `[data-theme="light"] .result-empty`/`.result-empty svg`/`.result-empty p`/`.result-empty span` 四条亮色覆盖规则，图标线条与文字统一为 var(--text) 黑色，图标外框黑色半透明背景改为 transparent (关联方案ID: DESIGN-20260726-005)
- [修改] app/globals.css PC 端明暗切换按钮统一：`.theme-toggle` 加入第 177-195 行通用按钮选择器组与第 197-203 行按钮基础组，获得 border/background/display/min-height/padding 等完整盒模型样式；新增 `.studio-header-actions .theme-toggle` 宽度约束规则（72px、height 38px、padding 0、gap 6px），与 `.language-toggle` 完全对齐；新增 `[data-theme="light"] .theme-toggle { color: var(--text); }` 亮色文字覆盖确保 ::after "亮"字可见 (关联方案ID: DESIGN-20260726-005)
- [修改] app/globals.css 手机端 `.mobile-floating-theme` 补全三个遗漏规则组：transition 过渡组、detached 浮起状态组、light+detached 亮色浮起组，使明暗按钮在悬浮过渡与滚动浮起状态下与同组按钮视觉一致 (关联方案ID: DESIGN-20260726-005)
- [修改] components/mobile/mobile-studio-app.tsx 手机端顶部新增明暗切换按钮：import 补充 Moon/Sun 图标；useTheme 取 toggleTheme；MobileFloatingTopBar 组件扩展 theme/onTheme props，在个人中心与中英文按钮中间插入 `.mobile-floating-theme` 按钮，复用 PC 端 useTheme/toggleTheme 交互逻辑，图标随主题切换（dark→Moon、light→Sun） (关联方案ID: DESIGN-20260726-005)

### 文档
- [文档] docs/ARCHITECTURE.md ADR-0005 影响字段补充 DESIGN-005 变更说明（空状态亮色适配、PC 端明暗按钮盒模型统一、手机端明暗按钮入口新增），关联方案ID 追加 DESIGN-20260726-005 (关联方案ID: DESIGN-20260726-005)

## v0.1.8 - 2026-07-26

### 修改
- [修改] app/globals.css 模式切换页签（`.trae-mode-switch`/`.mode-pill`）硬编码替换为 CSS 变量：容器 background/border 替换为 var(--surface-2)/var(--line)，按钮 color 替换为 var(--muted)；新增 `[data-theme="light"]` 亮色覆盖规则集，将暗色白底 pill 反转为深底浅字（background: var(--text)），激活态文字改为 var(--bg)，box-shadow 弱化为浅色阴影 (关联方案ID: DESIGN-20260726-004)
- [修改] app/globals.css 配件下拉菜单（`.parts-dropdown-inner`）硬编码替换为 CSS 变量：background 由 rgba(16,16,18,0.94) 替换为 var(--surface)，border 由 #27272f 替换为 var(--line) (关联方案ID: DESIGN-20260726-004)
- [修改] app/globals.css 对话模式侧边栏与头部约 15 处硬编码替换为 CSS 变量：`.chat-history-sidebar`（含第 11070 行 collapsed 重复定义）background/color/border 替换为 var(--surface-2)/var(--text)/var(--line-soft)；`.chat-history-head` 及子元素 border/color/background 替换为变量；`.assistant-mark` 反转为 var(--text) 底 + var(--bg) 字；`.chat-history-head.collapsed button` border/background 替换为 var(--line-soft)/var(--input-bg) (关联方案ID: DESIGN-20260726-004)
- [修改] app/globals.css 对话模式历史列表约 10 处硬编码替换为 CSS 变量：`.history-section-title`/`.chat-row`/`.chat-user-card`/`.chat-pin`/`.chat-part-preview-button` 的 color/background/border 替换为 var(--muted-2)/var(--text)/var(--surface-3)/var(--line)/var(--input-bg) 等变量 (关联方案ID: DESIGN-20260726-004)
- [修改] app/globals.css 对话模式搜索与新对话按钮：`.chat-search input` color 替换为 var(--text)；新增 `[data-theme="light"] .new-chat-button` 亮色覆盖，将白底黑字 CTA 反转为深底浅字（var(--text) 底 + var(--bg) 字） (关联方案ID: DESIGN-20260726-004)
- [修改] app/globals.css 对话模式空状态与粒子：`.chat-empty h2` color 替换为 var(--text)；`.prompt-suggestions button` border/background/color 替换为 var(--line)/var(--surface)/var(--text)；新增 `[data-theme="light"] .particle-orb` 亮色覆盖，将白色粒子反转为深色粒子（#1a1a1c/rgba(26,26,28,0.5)），drop-shadow 同步调整 (关联方案ID: DESIGN-20260726-004)
- [修改] app/globals.css 对话模式气泡约 10 处硬编码替换为 CSS 变量：`.message-avatar`/`.message-body`/`.message-bubble.user .message-body`/`.message-attachments img`/`.chat-image-fallback`/`.loading-dots i` 的 background/color/border 替换为 var(--surface-3)/var(--surface-2)/var(--surface)/var(--text)/var(--line)/var(--muted) 等变量 (关联方案ID: DESIGN-20260726-004)
- [修改] app/globals.css 对话模式结果卡片与附件约 8 处硬编码替换为 CSS 变量：`.chat-result-card button`/`.chat-upload-chip`/`.chat-part-chip`/`.chat-upload-chip.selected`/`.chat-part-chip button`/`.chat-vehicle-thumb` 的 border/background/color 替换为 var(--line)/var(--surface-3)/var(--input-bg)/var(--text) 等变量 (关联方案ID: DESIGN-20260726-004)
- [修改] app/globals.css 对话模式 composer 约 12 处硬编码替换为 CSS 变量：`.chat-composer` border/background 替换为 var(--line)/var(--surface)；`.chat-composer textarea`/`::placeholder` color 替换为 var(--text)/var(--muted-2)；`.chat-composer-footer` 及按钮 border/color 替换为变量；`.chat-notice`/`.chat-generating` color 替换为 var(--muted)/var(--muted-2)；新增 `[data-theme="light"] .chat-composer` 浅色阴影覆盖与 `[data-theme="light"] .chat-composer-footer > button.primary` CTA 反转覆盖 (关联方案ID: DESIGN-20260726-004)
- [修改] app/globals.css 对话模式 prompt 下拉与其他约 10 处硬编码替换为 CSS 变量：`.prompt-dropdown-trigger`/`.prompt-dropdown-list`/`.prompt-dropdown-list button` 的 border/background/color 替换为 var(--line)/var(--input-bg)/var(--surface)/var(--text)/var(--muted) 等变量；`.context-toggle button` border/background 替换为变量；新增 `[data-theme="light"] .brand-filter-row button.selected`、`[data-theme="light"] .context-toggle button.selected` 亮色反转覆盖 (关联方案ID: DESIGN-20260726-004)
- [修改] app/globals.css 订阅/支付弹窗（pricing-template 系列）约 15 处新增 `[data-theme="light"]` 亮色覆盖规则：`.pricing-template-card`/`.pricing-plan-title *`/`.pricing-featured`/`.payment-template-modal`/`.payment-template-options button`/`.subscribe-modal.pricing-template .pricing-template-card` 等选择器的 border/background/color 替换为 var(--line)/var(--surface)/var(--text)/var(--muted) 等变量；保留品牌蓝按钮不改，仅适配 disabled 态 (关联方案ID: DESIGN-20260726-004)
- [修改] app/globals.css context-choice-actions 选中态新增 `[data-theme="light"] .context-choice-actions button.selected` 亮色反转覆盖，将浅底深字反转为深底浅字（var(--text) 底 + var(--bg) 字） (关联方案ID: DESIGN-20260726-004)

### 文档
- [文档] docs/ARCHITECTURE.md ADR-0005 影响字段补充亮色主题遗漏区域补全说明（含模式页签、配件下拉、对话模式、订阅弹窗、context-choice 等） (关联方案ID: DESIGN-20260726-004)

## v0.1.7 - 2026-07-26

### 修改
- [修改] app/globals.css `[data-theme="light"]` 亮色变量取值重构：--bg 由 #f5f5f7 调整为 #f7f7f7，--panel/--surface 提高不透明度至 0.92 并改为纯白基底 #ffffff，--surface-2 改为 #f7f7f7 浅灰，--surface-3 改为 #f0f0f2，--line 柔化为 #e5e5e8，形成 #f7f7f7 底 + #ffffff 卡面的纯净白系层次 (关联方案ID: DESIGN-20260726-003)
- [修改] app/globals.css 新增 `--input-bg` 语义变量（:root 暗色 rgba(0,0,0,0.4)，[data-theme="light"] 亮色 rgba(0,0,0,0.04)），统一控件输入框半透明背景，替换原 12 处硬编码 rgba(0,0,0,0.3~0.5) (关联方案ID: DESIGN-20260726-003)
- [修改] app/globals.css `.app-shell` 新增 `[data-theme="light"]` 亮色覆盖规则，将硬编码 #000 黑底 + 金色径向渐变替换为 #f7f7f7 浅底 + 极淡金色径向（透明度 0.05）；`::before`/`::after` 侧边金色纹理透明度降至 0.1 弱化保留，修复 PC 端最底层背景不随主题切换的核心问题 (关联方案ID: DESIGN-20260726-003)
- [修改] app/globals.css PC 端 15 处硬编码深色大面积底色替换为 CSS 变量：.chat-mode-shell/.chat-search/.chat-workspace 替换为 var(--bg)/var(--surface-2)；.admin-shell 替换为 var(--bg)；.admin-sidebar 替换为 var(--surface-2)；.workflow-designer/.workflow-template-sidebar/.workflow-properties/.workflow-search/.workflow-prop-body select 替换为 var(--bg)/var(--surface-2)/var(--surface-3)；.upload-tile img 及 3 处变体、.history-list button、.admin-image-lightbox-panel 替换为 var(--surface-3)/var(--surface) (关联方案ID: DESIGN-20260726-003)
- [修改] app/globals.css PC 端控件半透明深色底替换为 var(--input-bg)：.language-toggle 等按钮组、.prompt-field textarea、.upload-tile、.custom-color-native input、.asset-card、.login-panel input 等管理后台表单、.admin-asset-row 及其按钮、.admin-toast-overlay、.brand-filter-row button、.action-row a、.parts-search、.auth-modal label > input、.account-panel-tabs、.gradient-color-control-head input[type="color"]、.color-policy-check 共 15 处 (关联方案ID: DESIGN-20260726-003)
- [修改] app/globals.css `.chat-bg` 新增 `[data-theme="light"]` 亮色渐变覆盖，将原深色 linear-gradient(#050506/#080a12) 替换为浅色 linear-gradient(#f7f7f7/#ffffff)，网格线透明度降至 0.04 (关联方案ID: DESIGN-20260726-003)
- [修改] app/globals.css `.result-window` 新增 `[data-theme="light"]` 亮色覆盖，将原 rgba(0,0,0,0.18) 底替换为 var(--surface-3) + 极淡金色径向（透明度 0.05） (关联方案ID: DESIGN-20260726-003)
- [修改] components/car-mod-studio.tsx 第 3752 行 result-window 的 --paint 回退值由 #050506 改为 #1a1a1c，避免亮色下结果窗口出现近黑底 (关联方案ID: DESIGN-20260726-003)

### 文档
- [文档] docs/ARCHITECTURE.md ADR-0005 影响字段补充 PC 端亮色色彩体系重构说明 (关联方案ID: DESIGN-20260726-003)

## v0.1.6 - 2026-07-26

### 新增
- [新增] components/theme-context.tsx 全站主题 Context（ThemeProvider + useTheme），管理 dark/light 主题状态、localStorage 持久化（键名 car-mod-studio-theme）、系统 prefers-color-scheme 偏好监听、`<html data-theme>` 属性同步 (关联方案ID: DESIGN-20260726-002)
- [新增] app/layout.tsx 防闪烁内联脚本，在 React hydration 前读取 localStorage/系统偏好并设置 `<html data-theme>`，避免首屏 FOUC (关联方案ID: DESIGN-20260726-002)
- [新增] app/globals.css `[data-theme="light"]` 桌面端亮色变量覆盖集（--bg/--panel/--surface/--text/--muted/--line/--shadow 等），偏白色调 (关联方案ID: DESIGN-20260726-002)
- [新增] app/globals.css `.theme-toggle` 样式类，镜像 `.language-toggle` 视觉风格，`::after` 伪元素显示"暗"/"亮"标签 (关联方案ID: DESIGN-20260726-002)
- [新增] components/car-mod-studio.tsx 桌面端头部中英文切换按钮旁的主题切换按钮（Moon/Sun 图标 + 暗/亮文案） (关联方案ID: DESIGN-20260726-002)

### 修改
- [修改] app/layout.tsx 用 ThemeProvider 包裹 children，全站注入主题 Context (关联方案ID: DESIGN-20260726-002)
- [修改] components/car-mod-studio.tsx 移除 mobileTheme 局部 state、强制 dark 的 useEffect、toggleMobileTheme 函数、MobileTheme 类型与 MOBILE_THEME_STORAGE_KEY 常量；改用 useTheme() 获取全局主题状态；原 mobile-theme-toggle 按钮改为 theme-toggle 类名绑定全局 theme/toggleTheme (关联方案ID: DESIGN-20260726-002)
- [修改] components/mobile/mobile-studio-app.tsx 移除 MobileStudioAppProps 中的 mobileTheme/toggleMobileTheme 字段与 MobileTheme 类型；MobileStudioApp/MobileProfilePage/LegacyMobileProfilePage 内部改用 useTheme() 获取主题 (关联方案ID: DESIGN-20260726-002)
- [修改] app/globals.css 移动端媒体查询中 `.mobile-theme-toggle` 选择器同步更名为 `.theme-toggle` (关联方案ID: DESIGN-20260726-002)

### 文档
- [文档] docs/ARCHITECTURE.md 展示层追加 theme-context.tsx 组件说明 (关联方案ID: DESIGN-20260726-002)
- [文档] docs/ARCHITECTURE.md 新增 ADR-0005：全站主题切换方案决策（原生 CSS 变量 + data-theme 属性，弃用 next-themes 残留） (关联方案ID: DESIGN-20260726-002)

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

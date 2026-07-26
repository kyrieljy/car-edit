# AI Agent 规范

## 角色定义

AI Agent 在 ModCar AI 项目中承担以下职责：

- **代码编写与修改**：基于设计方案（`docs/designs/`）实现功能。
- **文档维护**：按照 DOCS-SPEC.md 规范同步更新项目文档。
- **Bug 修复**：定位并修复问题，更新相关文档。
- **架构决策记录**：新增 ADR 到 `ARCHITECTURE.md`。
- **FAQ 沉淀**：记录非显而易见的问题及解决方案。

### 能力边界

- Agent **不修改**已归档的设计方案文件（`docs/designs/` 下的方案一旦归档即只读）。
- Agent **不擅自生成**非必要的文件（如额外的 README 等）。
- Agent 的代码变更**需遵循**编码规范和 UI 约束。

---

## 编码规范

### 命名规范

| 类别 | 规则 | 示例 |
|------|------|------|
| 文件命名 | kebab-case | `car-mod-studio.tsx`、`generation-engine.ts` |
| 目录命名 | kebab-case | `app/api/auth/`、`lib/server/` |
| 组件命名 | PascalCase | `CarModStudio`、`ChatMode`、`AuthModal` |
| 变量和函数 | camelCase | `currentUser`、`buildGenerationPrompt` |
| 常量 | UPPER_SNAKE_CASE | `ACCOUNT_MESSAGES_REFRESH_EVENT`、`IMAGE_UPLOAD_MAX_MB` |
| 类型/接口 | PascalCase | `GenerationJob`、`ProviderConfig`、`AuthUser` |
| 数据库表名 | snake_case | `generation_jobs`、`usage_ledger`、`chat_sessions` |
| API 路由 | kebab-case 路径 | `/api/vehicle-recognition`、`api/download-image` |
| 环境变量 | UPPER_SNAKE_CASE，前缀区分用途 | `DATABASE_PATH`、`ENCRYPTION_KEY` |

### 代码风格

- **缩进**：2 空格
- **引号**：单引号（TS/TSX）、双引号（JSON）
- **分号**：必须使用
- **行宽**：无硬限制，保持可读性
- **注释格式**：JSDoc（函数/类）、`//`（行内注释）
- **import 顺序**：外部依赖 → 内部 lib → 组件 → 类型
- **TypeScript**：strict 模式开启
- **ESLint 规则**：继承 `next/core-web-vitals`，关闭 `react/no-unescaped-entities` 和 `@next/next/no-img-element`

### 结构约定

| 类别 | 位置 |
|------|------|
| 页面文件 | `app/` 目录（App Router 约定） |
| API 路由 | `app/api/` 对应模块目录 |
| 可复用组件 | `components/` |
| 移动端专属组件 | `components/mobile/` |
| 服务端逻辑 | `lib/server/` |
| 客户端工具 | `lib/client/` |
| 共享类型 | `lib/types.ts` |
| 核心业务逻辑 | `lib/`（如 `generation-core.ts`、`prompts.ts`、`catalog.ts`） |
| UI 基础组件 | `components/ui/`（shadcn/ui 生成，不做严格 TS 检查） |
| 工具脚本 | `scripts/` |
| 数据文件 | `data/` |
| 静态资源 | `public/assets/` |

### 禁止事项

- 禁止使用 `var` 声明变量
- 禁止使用 `any` 类型（除非已有代码如此且改动范围极小）
- 禁止在路由处理器中使用 `console.log`（生产环境）
- 禁止直接操作 DOM（使用 React 声明式编程）
- 禁止引入 Element UI、Ant Design 等 shadcn/ui 之外的 UI 组件库
- 禁止混用 CSS 方案（项目使用纯 CSS，不引入 Tailwind class 到自定义组件）
- 禁止混用图标库（必须使用 lucide-react）
- 禁止在组件中使用内联 style 覆盖设计令牌
- 禁止硬编码颜色值（如 `#1890ff`）、像素间距（如 `margin: 16px`）、字号（如 `font-size: 14px`），必须引用 CSS 变量
- 禁止脱离 MainLayout 独立渲染页面（如需要）
- 禁止手写 HTML table 替代组件库 Table
- 禁止使用 `window.confirm` / `alert`，必须使用 `Modal.confirm` / `message`

---

## 领域约束

- **框架版本**：项目使用 Next.js 14 App Router，必须使用 `app/` 目录约定。
- **数据库**：SQLite（`node:sqlite`），API Key 使用 AES-256-CBC 加密存储。
- **认证**：基于 Cookie session（`car_mod_session`），30 天有效期。
- **AI Provider**：按能力分类（`llm` / `vision` / `image_generation` / `embedding`），通过 `ProviderConfig` 配置。
- **提示词管理**：使用版本化 Prompt Pack 管理，禁止直接修改已部署的提示词包。
- **图片存储**：采用双重目录（`data/` + `public/`），路径安全防护必须使用 `safeSingleFileName`。
- **API 权限**：路由必须通过 `requireUser()` 或 `requireAdminUser()` 做权限检查。
- **管理后台**：所有 API 必须验证管理员权限。

---

## UI 约束

### UI 技术栈锁定

- **组件库**：shadcn/ui（new-york 风格），禁止引入 Element UI、Ant Design。
- **CSS 方案**：纯 CSS（`globals.css` 定义设计令牌），禁止引入 Tailwind CSS 到自定义组件、禁止使用 CSS Modules、styled-components。
- **图标库**：lucide-react，禁止内联 SVG、禁止混用 `@ant-design/icons` 或其他图标库。
- **动画库**：framer-motion，禁止引入其他动画库。
- **禁止事项**：禁止引入 Element UI、Ant Design、Radix UI 原始组件（shadcn/ui 内部使用的除外）；禁止在组件中使用内联 style 覆盖组件库默认样式。

### 组件使用规范

#### 标准组件映射

| UI 场景 | 必须使用的组件 | 禁止的替代方式 |
|---------|---------------|----------------|
| 弹窗/对话框 | `createPortal` + 自定义 Modal 组件 | 禁止使用 `window.confirm` / `alert` |
| 动画/过渡 | framer-motion（`motion`、`AnimatePresence`） | 禁止手写 CSS animation |
| 图标 | lucide-react | 禁止内联 SVG / 混用图标库 |
| 页面过渡 | framer-motion spring 动画 | 禁止硬编码 CSS transition |
| 文件下载 | 自定义 `downloadImageAsset` 函数 | 禁止使用 `window.open` |

#### 自定义组件

以下组件位于 `components/` 目录，coding 生成 UI 时必须优先使用：

| 组件名 | 用途 | 关键 Props |
|--------|------|-----------|
| `CarModStudio` | 核心改车工作室（主组件） | 无（入口组件） |
| `ChatMode` | 聊天/对话模式 | `language`, `authUser`, `billing`, `onAuthRequired`, `onSubscribeRequired` |
| `AuthModal` | 全屏认证系统（移动+桌面） | `language`, `authOpen`, `onAuthClose`, `onAuthSuccess` |
| `SubscribeModal` | 会员订阅弹窗 | `language`, `subscribeOpen`, `onClose`, `onBillingChanged` |
| `AccountAvatar` | 用户头像 | `user`, `imageUrl`, `className`, `label` |
| `AdminConsole` | 管理后台（独立页面） | 无（入口组件） |
| `WorkflowDesigner` | 工作流可视化编辑 | `workflowConfig`, `promptTemplates`, `providers`, `onWorkflowChange` |
| `MobileStudioApp` | 移动端工作室 | 约 80+ props（完整状态传递） |
| `ImageComparisonSlider` | 原图/生成图重叠对比滑块（拖动手柄控制显示比例，支持自动播放） | `beforeSrc`, `afterSrc`, `altBefore`, `altAfter`, `initialPosition`, `className`, `autoPlay` |

#### 禁止事项

禁止在页面中重复实现已有组件库或自定义组件能覆盖的 UI 逻辑。

### 设计令牌（Design Tokens）

- **令牌定义位置**：`app/globals.css`

#### 必须使用的令牌类别

| 类别 | 用途 | 示例变量 |
|------|------|----------|
| 颜色 | 文字、背景、边框、状态色 | `--bg`, `--panel`, `--surface`, `--line`, `--text`, `--muted`, `--accent`, `--blue`, `--green`, `--red`, `--yellow`, `--input-bg`（控件半透明背景，暗色 rgba(0,0,0,0.4) / 亮色 rgba(0,0,0,0.04)） |
| 阴影 | 卡片、弹窗 | `--shadow` |
| 字体 | 标题、正文 | 主字体为等宽字体族（Courier New, JetBrains Mono），UI 字体为 Inter |

#### 硬编码数值禁止

禁止直接写死颜色值（如 `#1890ff`）、像素间距（如 `margin: 16px`）、字号（如 `font-size: 14px`），必须引用 CSS 变量。例外：`0` 和 `auto` 不受此限制。

#### 主题模式

项目支持暗色（dark）与亮色（light）双主题切换。主题状态由 `components/theme-context.tsx` 的 `ThemeProvider` 全局管理，通过 `<html data-theme="dark|light">` 属性驱动 CSS 变量切换。`app/globals.css` 中 `:root` 定义暗色变量，`[data-theme="light"]` 定义亮色覆盖集。禁止硬编码颜色值，必须引用 CSS 变量以确保主题切换时自动响应。

### 页面布局模式

#### 标准页面骨架

- **前台页面（工作室）**：CarModStudio 主组件，左侧配件选择 + 右侧图片预览 + 底部控制栏（桌面端）/ 底部抽屉切换（移动端）。
- **管理后台**：AdminConsole，左侧边栏导航 + 右侧内容区 + 顶栏面包屑。
- **聊天模式**：ChatMode，消息列表 + 底部输入栏 + 侧边会话列表（桌面端）/ 全屏消息列表（移动端）。

#### 布局组件

- `CarModStudio` 作为前台布局容器。
- `AdminConsole` 作为管理后台布局容器。

#### 响应式断点

- `760px`（`max-width: 760px` 为移动端），通过 `window.matchMedia` 检测。

#### 禁止事项

禁止在页面中手写与标准骨架功能重复的布局结构。

---

## 工具使用约定

| 命令 | 用途 |
|------|------|
| `npm run dev` | 开发环境启动（通过 `scripts/start-next-dev.mjs`） |
| `npm run smoke` | 端到端冒烟测试（`scripts/smoke.mjs`） |
| `npm run lint` | ESLint 代码检查 |
| `npm run audit:project` | 项目状态审计（`scripts/audit-project-state.mjs`） |
| `npm run config:validate` | 项目配置校验 |
| `npm run prompt:validate` | 提示词包校验（`scripts/validate-prompt-pack.mjs`） |
| `npm run config:export` | 导出当前配置快照 |
| `npm run provider:yunwu-default` | 切换云雾默认 Provider |

---

## 输出约束

- **语言要求**：与用户输入保持一致。
- **格式要求**：禁止使用 emoji；代码注释使用英文。
- **文件操作规则**：禁止擅自生成 README 等非必要文件；新文件必须放置在规范约定的目录位置。

---

> 最后更新时间：2026-07-26

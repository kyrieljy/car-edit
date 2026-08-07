# ModCar AI（car-mod-effect-studio）

## 项目简介

AI 驱动的汽车改装效果预览平台。用户上传车辆照片后，可通过两种模式生成改装效果：**配置模式**（自选配件组合）和**对话模式**（自然语言描述改装意图），AI 自动生成改装后的效果预览图，帮助用户在实车改装前直观地查看最终效果。

技术栈：Next.js 14 App Router + React 18 + TypeScript 5 + SQLite + shadcn/ui + framer-motion。

## 目录结构

```
├── app/                    # Next.js App Router 页面与路由
│   ├── api/                # API 路由（auth/billing/chat/garage/generations/admin/catalog 等）
│   ├── admin/              # 管理后台页面
│   ├── g/                  # 生成器快捷入口
│   ├── results/            # 生成结果图路由
│   ├── uploads/            # 上传文件路由
│   ├── globals.css         # 全局样式
│   ├── layout.tsx          # 根布局
│   └── page.tsx            # 首页
├── components/             # React 组件
│   ├── mobile/             # 移动端组件
│   ├── car-mod-studio.tsx  # 核心改车工作室
│   ├── chat-mode.tsx       # 对话模式
│   ├── auth-modal.tsx      # 认证弹窗
│   ├── subscribe-modal.tsx  # 订阅弹窗
│   ├── admin-console.tsx   # 管理后台
│   ├── workflow-designer.tsx # 工作流设计器
│   └── ...
├── config/                 # 配置文件
│   └── prompt-packs/       # 提示词版本包
├── data/                   # 数据文件（SQLite 数据库、配件清单、测试用例）
├── docs/                   # 项目文档
├── lib/                    # 核心库
│   ├── server/             # 服务端模块
│   ├── client/             # 客户端模块
│   ├── types.ts            # 类型定义
│   ├── generation-core.ts  # 生成核心逻辑
│   ├── catalog.ts          # 目录种子数据
│   ├── prompts.ts          # 提示词构建引擎
│   └── ...
├── public/                 # 静态资源
│   └── assets/             # 头像、配件参考图、结果图等
├── scripts/                # 工具脚本
├── skills/                 # 技能系统
├── prototypes/             # 原型设计
└── package.json
```

## 快速开始

### 环境要求

- Node.js 18+
- npm

### 安装步骤

```bash
npm install
```

### 启动命令

```bash
npm run dev
```

启动后通过自定义开发服务器（`scripts/start-next-dev.mjs`）运行，默认访问地址为 `http://127.0.0.1:3000`。

### 冒烟测试

```bash
npm run smoke
```

### 故障排除

**API 路由全部返回 404**

如果启动后页面一直显示加载中，且 `/api/catalog`、`/api/auth/me` 等接口返回 404，通常是因为 `.next` 构建缓存损坏（NTFS 目录条目不一致）。项目已将构建输出目录配置为 `.next-build`（见 `next.config.mjs` 中的 `distDir`），如果问题仍然出现，手动删除构建缓存后重启：

```bash
# Windows PowerShell
Remove-Item -Recurse -Force .next-build
npm run dev
```

如果 `.next-build` 也无法删除，以管理员身份打开终端执行上述命令，或重启电脑后重试。

### 其他脚本

| 命令 | 说明 |
|------|------|
| `npm run lint` | ESLint 代码检查 |
| `npm run audit:project` | 项目状态审计 |
| `npm run config:validate` | 配置校验 |
| `npm run prompt:validate` | 提示词包校验 |

## 配置说明

以下为项目关键配置项及其含义：

| 配置文件 | 说明 |
|----------|------|
| `next.config.mjs` | 图片优化功能已关闭，适用于本项目的图片处理场景 |
| `tsconfig.json` | 配置路径别名 `@/*`，指向项目根目录下的各模块 |

### 已废弃的环境变量

画质参数已迁移至管理后台的 Provider「画质参数」配置（DESIGN-20260807-001），以下环境变量不再作为首选配置，仅在对应 Provider 缺失内置模板时作为兜底，请勿在新部署中依赖：

| 环境变量 | 原用途 | 替代方式 |
|----------|--------|----------|
| `YUNWU_IMAGE_QUALITY` | A 类 Provider 默认 `quality` 值 | 管理后台 Provider 画质参数（内置模板 + 可配置） |
| `YUNWU_IMAGE_*` 系列 | A 类 Provider 其他硬编码画质参数 | 同上 |
| `YUNWU_GEMINI_IMAGE_SIZE` | Gemini（B 类）默认 `imageSize` | 同上 |
| `YUNWU_NANO_RESOLUTION` | Nano Banana（B 类）默认 `resolution` | 同上 |
| `NANO_BANANA_302_RESOLUTION` | 302 链路 Nano Banana 默认 `resolution` | 同上 |

> 升级时系统会通过 `backfillProviderImageParams()` 从以上环境变量的有效值回填 Provider 画质参数默认值，保证从旧版平滑迁移且零行为变化。

> 管理员可在管理后台「模型 API」菜单的「画质参数」分区对每个参数点「对比测试」，对全部枚举值并行真实生图横评；菜单底部「测试配件设置」提供全局单份固定基准（原图+配件+车漆+姿态）。对比测试为真实生图（消耗底层模型额度）、但不扣用户额度、不写生成记录（DESIGN-20260807-002）。

## 相关文档

- [文档规范](docs/DOCS-SPEC.md)
- [架构设计](docs/ARCHITECTURE.md)
- [API 参考](docs/API_REFERENCE.md)
- [数据库设计](docs/DB_SCHEMA.md)
- [业务领域](docs/BUSINESS_DOMAIN.md)
- [AI Agent 规范](docs/AGENTS.md)
- [变更日志](docs/CHANGELOG.md)
- [常见问题](docs/faq/)

> 最后更新时间：2026-08-07

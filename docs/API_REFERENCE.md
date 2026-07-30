# API 参考

## 概述

### Base URL

```
http://127.0.0.1:3000  （开发环境）
```

### 鉴权方式

采用 Cookie-based Session 鉴权。

| 属性 | 值 |
|------|------|
| Cookie 名称 | `car_mod_session` |
| HttpOnly | 是 |
| 有效期 | 30 天 |

### 接口分类

| 类别 | 说明 |
|------|------|
| 公开接口 | 无需认证即可访问 |
| 需认证接口 | 需携带有效 Session Cookie |
| 需管理员权限接口 | 除认证外，用户角色须为 `admin` |

### 通用请求/响应头

| 头部 | 值 | 说明 |
|------|------|------|
| Content-Type | `application/json` | JSON 请求/响应 |
| Content-Type | `text/event-stream` | NDJSON 流响应 |
| Content-Type | `multipart/form-data` | 文件上传请求 |

### 通用错误码

| 状态码 | 含义 | 说明 |
|--------|------|------|
| 400 | 请求参数错误 | 请求体字段缺失或格式不合法 |
| 401 | 未认证 | 缺少有效 Session Cookie 或 Session 已过期 |
| 402 | 额度不足 | 用户当前套餐的调用次数已耗尽 |
| 403 | 权限不足 | 角色无权访问该资源 |
| 405 | 方法不允许 | HTTP 方法不被该路由支持 |
| 409 | 冲突 | 资源状态冲突（如手机号已注册） |
| 500 | 服务器错误 | 服务端未预期异常 |
| 502 | 上游服务错误 | 依赖的外部 AI 服务不可用或响应异常 |

### 通用响应结构

成功响应：

```json
{
  "ok": true,
  // ...其他业务字段
}
```

失败响应：

```json
{
  "error": "错误描述信息",
  "code": "ERROR_CODE"
}
```

### NDJSON 流响应格式

流式接口（如 `/api/chat/messages`、`/api/generations`）在 `streamProgress=true` 时，以 NDJSON 格式返回进度和结果事件，每行一个 JSON 对象。

进度事件：

```json
{"type": "progress", "step": "vehicle_recognition", "message": "识别车辆中...", "elapsedMs": 1200}
```

结果事件：

```json
{"type": "result", "status": 200, "ok": true, "body": { ... }}
```

---

## 接口清单

### 认证模块（Auth）

#### 发送短信验证码

- **路径**：`POST /api/auth/send-code`
- **描述**：向指定手机号发送短信验证码，用于登录、注册、换绑手机号、管理员验证或密码重置。管理员发码（purpose=admin）需先验证密码。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | phone | string | 是* | 目标手机号（purpose 为 admin 或 change_phone 时非必填） |
  | purpose | string | 否 | 用途，取值：`login`、`register`、`change_phone`、`admin`、`wechat`、`reset_password`，默认 `login` |
  | identifier | string | 否 | 管理员发码时用于密码验证的用户标识（用户名/手机号/邮箱） |
  | username | string | 否 | 管理员发码时用于密码验证的用户名（identifier 的别名） |
  | password | string | 否 | 管理员发码时用于密码验证的密码 |

- **请求示例**：

  ```json
  {
    "phone": "13800138000",
    "purpose": "login"
  }
  ```

- **响应格式**：

  ```json
  {
    "ok": true,
    "expiresAt": "2026-07-25T10:30:00.000Z",
    "devCode": "123456"
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | ok | boolean | 是否发送成功 |
  | expiresAt | string | 验证码过期时间（ISO 8601） |
  | devCode | string | 开发环境返回的验证码明文，仅非生产环境返回 |

- **错误码**：

  | 状态码 | code | 说明 |
  |--------|------|------|
  | 400 | `INVALID_PHONE` | 手机号格式不合法 |
  | 409 | `PHONE_ALREADY_REGISTERED` | 注册时手机号已被使用 |
  | 404 | `PHONE_NOT_REGISTERED` | 密码重置时手机号未注册 |
  | 400 | `ADMIN_RESET_BLOCKED` | 管理员账号不允许通过此流程重置密码 |

- **关联数据表**：`verification_codes`

---

#### 用户登录

- **路径**：`POST /api/auth/login`
- **描述**：支持密码登录和手机验证码登录两种模式。管理员使用密码登录时需额外提供手机验证码（adminCode）。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | mode | string | 否 | 登录模式，取值：`password`、`code`，默认 `password` |
  | identifier | string | 否 | 用户标识（用户名/手机号/邮箱），password 模式使用 |
  | username | string | 否 | 用户名，identifier 的别名 |
  | phone | string | 否 | 手机号，password 模式可作为 identifier 使用，code 模式为必填 |
  | password | string | 否 | 密码，password 模式必填 |
  | code | string | 否 | 短信验证码，code 模式必填 |
  | bindRequired | boolean | 否 | code 模式下是否要求绑定已有账号 |
  | adminCode | string | 否 | 管理员二次验证的手机验证码 |

- **请求示例**：

  ```json
  {
    "mode": "password",
    "identifier": "admin",
    "password": "mypassword",
    "adminCode": "123456"
  }
  ```

- **响应格式**：

  登录成功：

  ```json
  {
    "user": {
      "id": "u_xxxxx",
      "username": "admin",
      "name": "管理员",
      "email": "",
      "phone": "138****8000",
      "avatarId": "",
      "avatarUrl": "",
      "role": "admin",
      "plan": "internal",
      "status": "active",
      "createdAt": 1700000000000,
      "lastLoginAt": 1784980000000,
      "updatedAt": 1784980000000
    }
  }
  ```

  需要绑定：

  ```json
  {
    "requiresBinding": true,
    "phone": "13800138000"
  }
  ```

  管理员需要验证码：

  ```json
  {
    "error": "管理员需要手机号验证码。",
    "requireAdminCode": true,
    "phone": "138 ****8000"
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | user | AuthUser | 登录成功时返回的用户对象 |
  | requiresBinding | boolean | code 模式下需要绑定已有账号 |
  | phone | string | 手机号（绑定或验证码场景） |
  | requireAdminCode | boolean | 管理员需额外提供手机验证码 |

- **错误码**：

  | 状态码 | code | 说明 |
  |--------|------|------|
  | 401 | - | 用户名/密码错误或验证码无效 |
  | 428 | - | 管理员登录缺少 adminCode |

- **关联数据表**：`users`

---

#### 用户注册

- **路径**：`POST /api/auth/register`
- **描述**：通过手机号 + 验证码创建新用户账号。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | phone | string | 是 | 手机号 |
  | username | string | 是 | 用户名 |
  | password | string | 是 | 密码 |
  | code | string | 是 | 短信验证码 |
  | purpose | string | 是 | 验证码用途，须为 `register` |

- **请求示例**：

  ```json
  {
    "phone": "13800138000",
    "username": "newuser",
    "password": "mypassword123",
    "code": "123456",
    "purpose": "register"
  }
  ```

- **响应格式**：

  ```json
  {
    "user": {
      "id": "u_xxxxx",
      "username": "newuser",
      "name": "",
      "email": "",
      "phone": "13800138000",
      "avatarId": "",
      "avatarUrl": "",
      "role": "user",
      "plan": "free",
      "status": "active",
      "createdAt": 1784980000000,
      "lastLoginAt": 0,
      "updatedAt": 1784980000000
    }
  }
  ```

- **错误码**：400（参数缺失或验证码无效）、409（用户名或手机号已存在）

- **关联数据表**：`users`

---

#### 退出登录

- **路径**：`POST /api/auth/logout`
- **描述**：销毁当前 Session，清除登录状态。
- **请求参数**：无
- **响应格式**：

  ```json
  {
    "ok": true
  }
  ```

---

#### 获取当前用户信息

- **路径**：`GET /api/auth/me`
- **描述**：获取当前 Session 对应的用户信息及计费状态。无需认证，未登录时返回 `null`。
- **请求参数**：无
- **响应格式**：

  ```json
  {
    "user": {
      "id": "u_xxxxx",
      "username": "admin",
      "name": "管理员",
      "email": "",
      "phone": "13800138000",
      "avatarId": "",
      "avatarUrl": "",
      "role": "admin",
      "plan": "internal",
      "status": "active",
      "createdAt": 1700000000000,
      "lastLoginAt": 1784980000000,
      "updatedAt": 1784980000000
    },
    "billing": {
      "plan": { "id": "internal", "label": "Internal", ... },
      "subscription": null,
      "configUsed": 10,
      "chatUsedToday": 3,
      "configRemaining": "unlimited",
      "chatRemainingToday": "unlimited",
      "chatEnabled": true
    }
  }
  ```

  未登录时：

  ```json
  {
    "user": null,
    "billing": null
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | user | AuthUser or null | 当前用户信息，未登录时为 null |
  | billing | EntitlementStatus or null | 当前计费状态，未登录时为 null |

---

#### 更新用户资料

- **路径**：`PATCH /api/auth/me`
- **描述**：更新当前用户的显示名称、邮箱或头像。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | name | string | 否 | 显示名称 |
  | email | string | 否 | 邮箱地址 |
  | avatarId | string | 否 | 头像预设 ID |

- **请求示例**：

  ```json
  {
    "name": "新名称",
    "avatarId": "preset_001"
  }
  ```

- **响应格式**：

  ```json
  {
    "user": { "...": "AuthUser 对象" },
    "billing": { "...": "EntitlementStatus 对象" }
  }
  ```

- **错误码**：400（更新失败）、401（未认证）

- **关联数据表**：`users`

---

#### 修改密码

- **路径**：`POST /api/auth/password`
- **描述**：验证当前密码后修改为新密码。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | currentPassword | string | 是 | 当前密码 |
  | nextPassword | string | 是 | 新密码 |

- **请求示例**：

  ```json
  {
    "currentPassword": "oldpassword",
    "nextPassword": "newpassword"
  }
  ```

- **响应格式**：

  ```json
  {
    "user": { "...": "AuthUser 对象" },
    "billing": { "...": "EntitlementStatus 对象" }
  }
  ```

- **错误码**：400（当前密码错误）、401（未认证）

- **关联数据表**：`users`

---

#### 换绑手机号

- **路径**：`POST /api/auth/phone`
- **描述**：通过手机验证码换绑当前用户的手机号。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | phone | string | 是 | 新手机号 |
  | code | string | 是 | 短信验证码（须先调用 send-code，purpose=change_phone） |

- **请求示例**：

  ```json
  {
    "phone": "13900139000",
    "code": "123456"
  }
  ```

- **响应格式**：

  ```json
  {
    "user": { "...": "AuthUser 对象" },
    "billing": { "...": "EntitlementStatus 对象" }
  }
  ```

- **错误码**：400（验证码无效）、401（未认证）

- **关联数据表**：`users`

---

#### 重置密码

- **路径**：`POST /api/auth/reset-password`
- **描述**：通过手机号 + 验证码直接重置密码（无需登录）。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | phone | string | 是 | 手机号 |
  | code | string | 是 | 短信验证码（须先调用 send-code，purpose=reset_password） |
  | password | string | 是 | 新密码 |

- **请求示例**：

  ```json
  {
    "phone": "13800138000",
    "code": "123456",
    "password": "newpassword"
  }
  ```

- **响应格式**：

  ```json
  {
    "ok": true,
    "user": { "...": "AuthUser 对象" }
  }
  ```

- **错误码**：400（验证码无效）、404（手机号未注册）、403（管理员账号不允许此方式重置）

- **关联数据表**：`users`

---

#### 获取一键登录 Token

- **路径**：`POST /api/auth/one-tap/token`
- **描述**：获取一键登录的 accessToken 和 JWT Token。
- **请求参数**：无
- **响应格式**：

  ```json
  {
    "accessToken": "xxxxxxxx",
    "jwtToken": "eyJhbGciOi..."
  }
  ```

---

#### 一键登录提交

- **路径**：`POST /api/auth/one-tap`
- **描述**：使用一键登录 Token 完成免密登录。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | spToken | string | 否 | 运营商一键登录 Token |
  | token | string | 否 | JWT Token |
  | phone | string | 否 | 手机号 |
  | platform | string | 否 | 平台标识 |

- **响应格式**：

  ```json
  {
    "user": { "...": "AuthUser 对象" },
    "provider": "aliyun",
    "requestId": "req_xxxxx"
  }
  ```

---

#### 微信 Mock 登录

- **路径**：`POST /api/auth/wechat/mock`
- **描述**：微信登录的 Mock 接口，仅用于测试环境。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | register | boolean | 否 | 是否注册新用户 |
  | openId | string | 否 | 微信 OpenID |
  | username | string | 否 | 用户名（注册时） |
  | phone | string | 否 | 手机号 |
  | password | string | 否 | 密码 |
  | code | string | 否 | 短信验证码 |

---

### 计费模块（Billing）

#### 获取会员套餐列表

- **路径**：`GET /api/billing/plans`
- **描述**：获取所有已激活的会员套餐。
- **请求参数**：无
- **响应格式**：

  ```json
  {
    "plans": [
      {
        "id": "free",
        "label": "免费版",
        "priceCents": 0,
        "configLimit": 5,
        "chatDailyLimit": 10,
        "configUnlimited": false,
        "chatUnlimited": false,
        "chatEnabled": true,
        "active": true,
        "sortOrder": 0,
        "updatedAt": 1700000000000
      }
    ]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | plans | MembershipPlan[] | 套餐列表 |

---

#### 获取当前计费状态

- **路径**：`GET /api/billing/status`
- **描述**：获取当前登录用户的计费状态和额度使用情况。
- **请求参数**：无
- **响应格式**：

  ```json
  {
    "billing": {
      "plan": { "id": "pro", "label": "Pro", ... },
      "subscription": {
        "id": "sub_xxxxx",
        "userId": "u_xxxxx",
        "planId": "pro",
        "status": "active",
        "currentPeriodEnd": 1790000000000,
        "createdAt": 1700000000000,
        "updatedAt": 1700000000000
      },
      "configUsed": 5,
      "chatUsedToday": 2,
      "configRemaining": 45,
      "chatRemainingToday": 48,
      "chatEnabled": true
    }
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | billing | EntitlementStatus | 计费状态对象 |

- **错误码**：401（未认证）

---

#### 自助开通套餐

- **路径**：`POST /api/billing/checkout`
- **描述**：创建支付订单（模拟支付），用于用户自助开通/续费套餐。当前为模拟支付模式，不接入真实支付网关。
- **请求参数**（JSON）：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | planId | string | 是 | 会员计划 ID（`free` / `pro` / `max`） |
  | method | string | 否 | 支付方式（`wechat` / `alipay`），默认 `wechat` |
  | cycle | string | 否 | 计费周期（`monthly` / `yearly`），当前版本保留字段，固定为 monthly |

- **响应格式**：

  ```json
  {
    "order": {
      "id": "order_xxx",
      "userId": "user_xxx",
      "planId": "pro",
      "method": "wechat",
      "status": "pending",
      "amountCents": 2900,
      "createdAt": 1722200000000,
      "updatedAt": 1722200000000
    }
  }
  ```

- **错误码**：401（未认证）、400（参数错误或套餐无效）

---

#### 模拟支付完成

- **路径**：`POST /api/billing/mock-paid`
- **描述**：模拟支付完成，将订单状态更新为已支付，并更新用户订阅状态。当前为模拟支付模式。
- **请求参数**（JSON）：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | orderId | string | 是 | 订单 ID |

- **响应格式**：

  ```json
  {
    "ok": true,
    "billing": { "...": "EntitlementStatus 对象" }
  }
  ```

- **错误码**：401（未认证）、400（订单不存在或状态异常）

---

#### 查询用户订单

- **路径**：`GET /api/billing/orders`
- **描述**：查询当前登录用户的支付订单列表，按创建时间倒序排列。
- **请求参数**：无
- **响应格式**：

  ```json
  {
    "orders": [
      {
        "id": "order_xxx",
        "userId": "user_xxx",
        "planId": "pro",
        "method": "wechat",
        "status": "paid",
        "amountCents": 2900,
        "createdAt": 1722200000000,
        "updatedAt": 1722200000000
      }
    ]
  }
  ```

- **错误码**：401（未认证）

---

### 聊天模块（Chat）

#### 对话模式消息处理

- **路径**：`POST /api/chat/messages`
- **描述**：对话模式的核心接口，支持文本输入 + 车辆图片 + 配件图片。完整流程包含：图片校验、车辆识别、配件识别、意图解析、Prompt 构建、图片生成。支持 NDJSON 流式响应。
- **请求参数**（FormData）：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | sessionId | string | 否 | 对话会话 ID，为空时系统自动创建 |
  | text | string | 否 | 用户输入的自然语言指令 |
  | vehicleImage | File | 否 | 车辆图片文件 |
  | partImages | File[] | 否 | 配件参考图片（支持多张） |
  | responseLanguage | string | 否 | 响应语言 |
  | streamProgress | boolean | 否 | 是否开启 NDJSON 流式进度，默认 `false` |
  | contextMode | string | 否 | 上下文模式，取值：`latest`、`original` |
  | contextConfirmed | boolean | 否 | 是否确认使用当前上下文 |
  | partColorPolicyChoicesJson | string | 否 | 配件着色策略选择（JSON 字符串） |
  | dryRun | boolean | 否 | 试运行模式，仅执行意图解析不实际生成 |

- **请求示例**（curl）：

  ```bash
  curl -X POST http://127.0.0.1:3000/api/chat/messages \
    -b "car_mod_session=xxx" \
    -F "text=把这辆车的轮毂换成黑色的" \
    -F "vehicleImage=@vehicle.jpg" \
    -F "streamProgress=true"
  ```

- **响应格式**：

  非流式（streamProgress=false）：

  ```json
  {
    "message": { "...": "ChatMessage 对象" },
    "standardJson": { "...": "GenerationStandardJson 对象" }
  }
  ```

  流式（streamProgress=true，NDJSON）：

  ```
  {"type":"progress","step":"vehicle_recognition","message":"识别车辆中...","elapsedMs":1200}
  {"type":"progress","step":"part_recognition","message":"识别配件中...","elapsedMs":2400}
  {"type":"progress","step":"image_generation","message":"图片生成中...","elapsedMs":5000}
  {"type":"result","status":200,"ok":true,"body":{"message":{"...":"..."}}}
  ```

- **错误码**：

  | 状态码 | 说明 |
  |--------|------|
  | 400 | 参数缺失（如无车辆图片也无 sessionId） |
  | 401 | 未认证 |
  | 402 | 额度不足 |
  | 502 | 上游 AI 服务异常 |

- **关联数据表**：`chat_sessions`、`chat_messages`、`chat_attachments`、`generation_jobs`

---

#### 获取对话会话列表

- **路径**：`GET /api/chat/sessions`
- **描述**：获取当前用户的所有对话会话列表。
- **请求参数**：无
- **响应格式**：

  ```json
  {
    "sessions": [
      {
        "id": "session_xxxxx",
        "userId": "u_xxxxx",
        "title": "改装方案讨论",
        "pinned": false,
        "createdAt": 1784980000000,
        "updatedAt": 1784981000000,
        "messageCount": 5,
        "preview": "你想把轮毂换成什么样式？"
      }
    ]
  }
  ```

- **错误码**：401（未认证）

- **关联数据表**：`chat_sessions`

---

#### 创建对话会话

- **路径**：`POST /api/chat/sessions`
- **描述**：创建一个新的对话会话。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | title | string | 否 | 会话标题，默认 "New Chat" |

- **请求示例**：

  ```json
  {
    "title": "我的改装方案"
  }
  ```

- **响应格式**：

  ```json
  {
    "id": "session_xxxxx",
    "userId": "u_xxxxx",
    "title": "我的改装方案",
    "pinned": false,
    "createdAt": 1784980000000,
    "updatedAt": 1784980000000,
    "messageCount": 0,
    "preview": ""
  }
  ```

- **错误码**：401（未认证）

- **关联数据表**：`chat_sessions`

---

#### 获取会话消息历史

- **路径**：`GET /api/chat/sessions/[id]`
- **描述**：获取指定会话的全部消息历史，包含附件信息。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | id | string | 是 | 会话 ID（路径参数） |

- **响应格式**：

  ```json
  {
    "messages": [
      {
        "id": "msg_xxxxx",
        "sessionId": "session_xxxxx",
        "role": "user",
        "content": "把这辆车的轮毂换成黑色",
        "resultImageUrl": "",
        "guardrailStatus": "allowed",
        "guardrailReason": "",
        "contextMode": "latest",
        "standardJson": null,
        "createdAt": 1784980000000,
        "attachments": []
      }
    ]
  }
  ```

- **错误码**：401（未认证）、404（会话不存在）

- **关联数据表**：`chat_messages`、`chat_attachments`

---

#### 更新会话

- **路径**：`PATCH /api/chat/sessions/[id]`
- **描述**：更新会话的置顶状态或标题。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | id | string | 是 | 会话 ID（路径参数） |
  | pinned | boolean | 否 | 是否置顶 |
  | title | string | 否 | 新标题 |

- **请求示例**：

  ```json
  {
    "pinned": true,
    "title": "重要方案"
  }
  ```

- **响应格式**：

  ```json
  {
    "id": "session_xxxxx",
    "userId": "u_xxxxx",
    "title": "重要方案",
    "pinned": true,
    "createdAt": 1784980000000,
    "updatedAt": 1784982000000,
    "messageCount": 8,
    "preview": "最新消息预览"
  }
  ```

- **错误码**：401（未认证）

- **关联数据表**：`chat_sessions`

---

#### 删除会话

- **路径**：`DELETE /api/chat/sessions/[id]`
- **描述**：删除指定会话及其所有消息。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | id | string | 是 | 会话 ID（路径参数） |

- **响应格式**：

  ```json
  {
    "ok": true
  }
  ```

- **错误码**：401（未认证）、404（会话不存在）

- **关联数据表**：`chat_sessions`、`chat_messages`

---

#### 获取聊天推荐提示词

- **路径**：`GET /api/chat/suggestions`
- **描述**：获取系统推荐的聊天提示词列表，用于引导用户输入。公开接口。
- **请求参数**：无
- **响应格式**：

  ```json
  {
    "prompts": [
      "把这辆车的轮毂换成黑色的锻造轮毂",
      "给我的车贴一个哑光黑色的车膜",
      "降低车身高度，改成低趴风格"
    ]
  }
  ```

---

### 车库模块（Garage）

#### 获取用户生成历史

- **路径**：`GET /api/garage`
- **描述**：获取当前用户已保存到车库的全部生成记录，并自动物化远程图片到本地存储。
- **请求参数**：无
- **响应格式**：

  ```json
  {
    "generations": [
      {
        "id": "gen_xxxxx",
        "status": "succeeded",
        "mode": "chat",
        "userId": "u_xxxxx",
        "provider": "fal-ai",
        "vehicleUploadId": "upload_xxxxx",
        "sourceImageUrl": "/uploads/vehicle-gen_xxxxx.jpg",
        "displayVehicleModel": "Tesla Model 3",
        "resultImageUrl": "/results/provider_xxx-gen_xxxxx.png",
        "paintId": "p_xxxxx",
        "stance": 0,
        "selections": {},
        "selectionOptions": {},
        "standardJson": null,
        "workflowId": "wf_xxxxx",
        "promptVersion": "v1",
        "promptSummary": "...",
        "promptHidden": "...",
        "resultCheck": null,
        "retryCount": 0,
        "failureReason": "",
        "costCents": 10,
        "badCaseTags": [],
        "usageUnits": 1,
        "createdAt": 1784980000000
      }
    ]
  }
  ```

- **错误码**：401（未认证）

- **关联数据表**：`generation_jobs`

---

#### 保存生成结果到车库

- **路径**：`POST /api/garage`
- **描述**：将一个生成结果关联保存到当前用户的车库中。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | generationId | string | 是 | 生成记录 ID |

- **请求示例**：

  ```json
  {
    "generationId": "gen_xxxxx"
  }
  ```

- **响应格式**：

  ```json
  {
    "ok": true
  }
  ```

- **错误码**：400（generationId 缺失）、401（未认证）

- **关联数据表**：`generation_jobs`

---

#### 删除生成记录

- **路径**：`DELETE /api/garage/[id]`
- **描述**：从车库中删除指定的生成记录。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | id | string | 是 | 生成记录 ID（路径参数） |

- **响应格式**：

  ```json
  {
    "ok": true
  }
  ```

- **错误码**：401（未认证）、404（记录不存在）

- **关联数据表**：`generation_jobs`

---

### 生成模块（Generations）

#### 配置模式图片生成

- **路径**：`POST /api/generations`
- **描述**：配置模式的核心接口，通过车辆图片 + 选配参数（车漆、姿态、配件等）直接进行图片生成。支持 NDJSON 流式响应。
- **请求参数**（FormData）：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | vehicleImage | File | 是 | 车辆原图 |
  | paintId | string | 否 | 车漆 ID，留空则保持原车漆 |
  | stance | number | 否 | 姿态调整值（-100 ~ 100） |
  | selections | string | 否 | 配件选择映射（JSON 字符串），格式：`{"category_id": "asset_id", ...}` |
  | selectionOptions | string | 否 | 配件选配选项（JSON 字符串），格式：`{"category_id": {"colorPolicy": "body_color"}, ...}` |
  | vehicleNote | string | 否 | 车辆备注信息 |
  | displayVehicleModel | string | 否 | 显示用车型名称 |
  | paintFinishEffect | string | 否 | 车漆表面效果，取值：`gloss`、`metallic`、`matte`、`satin`、`pearl`、`chrome`、`gradient` |
  | gradientPaintJson | string | 否 | 渐变车漆配置（JSON 字符串），格式：`{"fromHex": "#000000", "toHex": "#ffffff", "direction": "front_to_rear"}` |
  | customPaintJson | string | 否 | 自定义车漆配置（JSON 字符串） |
  | streamProgress | boolean | 否 | 是否开启 NDJSON 流式进度，默认 `false` |
  | responseLanguage | string | 否 | 响应语言 |
  | dryRun | string | 否 | 试运行模式，取值 `1` 或 `true` 开启。开启后不扣费、不调用生图 API，仅返回 prompt 预览 (已更新 2026-07-25) |

- **请求示例**（curl）：

  ```bash
  curl -X POST http://127.0.0.1:3000/api/generations \
    -b "car_mod_session=xxx" \
    -F "vehicleImage=@vehicle.jpg" \
    -F 'selections={"wheels": "asset_001", "spoiler": "asset_002"}' \
    -F "stance=-30" \
    -F "paintFinishEffect=matte" \
    -F "streamProgress=true"
  ```

- **响应格式**：

  非流式（201）：

  ```json
  {
    "id": "gen_xxxxx",
    "status": "succeeded",
    "mode": "config",
    "userId": "u_xxxxx",
    "provider": "fal-ai",
    "vehicleUploadId": "upload_xxxxx",
    "sourceImageUrl": "/uploads/vehicle-gen_xxxxx.jpg",
    "resultImageUrl": "/results/provider_xxx-gen_xxxxx.png",
    "paintId": "p_xxxxx",
    "stance": -30,
    "selections": { "wheels": "asset_001" },
    "selectionOptions": {},
    "standardJson": { "...": "..." },
    "workflowId": "wf_xxxxx",
    "promptVersion": "v1",
    "promptSummary": "...",
    "promptHidden": "...",
    "resultCheck": { "passed": true, "score": 85, "..." : "..." },
    "retryCount": 0,
    "failureReason": "",
    "costCents": 10,
    "badCaseTags": [],
    "usageUnits": 1,
    "createdAt": 1784980000000
  }
  ```

  流式（NDJSON）：

  ```
  {"type":"progress","step":"upload_validation","message":"验证上传文件...","elapsedMs":100}
  {"type":"progress","step":"guardrail","message":"安全检查中...","elapsedMs":500}
  {"type":"progress","step":"vehicle_recognition","message":"识别车辆中...","elapsedMs":1200}
  {"type":"progress","step":"prompt_build","message":"构建生成提示词...","elapsedMs":3000}
  {"type":"progress","step":"image_generation","message":"图片生成中...","elapsedMs":5000}
  {"type":"result","status":201,"ok":true,"body":{"id":"gen_xxxxx","...":"..."}}
  ```

  Dry run 响应（dryRun=1 时，200）：

  ```json
  {
    "dryRun": true,
    "generationPreview": {
      "dryRun": true,
      "workflowId": "wf_xxxxx",
      "provider": "fal-ai",
      "providerLabel": "fal.ai",
      "sourceImageUrl": "dry-run",
      "partImageUrls": [],
      "promptVersion": "wf_xxxxx:v1",
      "promptSummary": "...",
      "promptHidden": "...",
      "negativePrompt": "...",
      "standardJson": { "...": "..." }
    },
    "standardJson": { "...": "..." }
  }
  ```

- **错误码**：

  | 状态码 | 说明 |
  |--------|------|
  | 400 | 缺少 vehicleImage 或参数格式错误 |
  | 401 | 未认证 |
  | 402 | 额度不足 |
  | 502 | 上游 AI 服务异常 |

- **关联数据表**：`generation_jobs`

---

### 其他接口

#### 获取完整目录数据

- **路径**：`GET /api/catalog`
- **描述**：获取系统完整的产品目录数据，包括配件分类、品牌、资产、车漆、AI 提供商配置、提示词模板和预设。公开接口。
- **请求参数**：无
- **响应格式**：

  ```json
  {
    "categories": [],
    "brands": [],
    "assets": [],
    "paints": [],
    "classicPaints": [],
    "providers": [],
    "promptTemplates": [],
    "promptPreset": {
      "id": "preset_xxxxx",
      "title": "Default Preset",
      "version": "v1",
      "body": "...",
      "negativePrompt": "...",
      "active": true,
      "createdAt": 1700000000000
    }
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | categories | PartCategory[] | 配件分类列表 |
  | brands | PartBrand[] | 品牌列表 |
  | assets | PartAsset[] | 配件资产列表 |
  | paints | PaintOption[] | 可选车漆列表 |
  | classicPaints | BrandClassicPaint[] | 经典品牌车漆列表 |
  | providers | ProviderConfig[] | AI 提供商配置列表 |
  | promptTemplates | PromptTemplate[] | 提示词模板列表 |
  | promptPreset | PromptPreset | 当前活跃的提示词预设 |

---

#### 车辆/配件识别

- **路径**：`POST /api/vehicle-recognition`
- **描述**：上传车辆图片和配件图片，调用 AI 进行识别，返回识别结果及安全检查结果。
- **请求参数**（FormData）：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | vehicleImage | File | 是 | 车辆图片文件 |
  | partImages | File[] | 否 | 配件参考图片（支持多张） |

- **响应格式**：

  ```json
  {
    "workflowId": "wf_xxxxx",
    "vehicle": {
      "model": "Tesla Model 3",
      "view": "front_left",
      "sourceImageUrl": "/uploads/vehicle-xxx.jpg",
      "confidence": 0.95
    },
    "parts": [
      {
        "category": "wheels",
        "categoryLabel": "轮毂",
        "source": "uploaded_reference",
        "assetId": "asset_001",
        "brand": "BBS",
        "model": "CH-R II",
        "variant": "20inch",
        "color": "silver",
        "finish": "gloss",
        "colorPolicy": "body_color",
        "colorPolicyPrompt": "...",
        "referenceImageUrl": "/uploads/part-xxx.jpg",
        "instruction": "",
        "optionSummary": ""
      }
    ],
    "guardrail": {
      "allowed": true,
      "reason": "",
      "detectedModel": "Tesla Model 3"
    }
  }
  ```

- **错误码**：400（缺少车辆图片）、401（未认证）、502（上游服务异常）

---

#### 图片下载

- **路径**：`GET /api/download-image`
- **描述**：代理下载外部图片并返回给客户端，设置 `Content-Disposition: attachment` 触发浏览器下载。
- **请求参数**（Query）：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | url | string | 是 | 目标图片 URL |
  | filename | string | 否 | 下载时的文件名 |

- **响应格式**：图片二进制流

  响应头：

  ```
  Content-Disposition: attachment; filename="xxx.jpg"
  Content-Type: image/jpeg
  ```

---

#### 图片代理

- **路径**：`GET /api/proxy-image`
- **描述**：代理访问外部图片，解决前端跨域问题。
- **请求参数**（Query）：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | url | string | 是 | 目标图片 URL |

- **响应格式**：图片二进制流

- **说明**：仅允许代理 `fal.media` 和 `file.302.ai` 域名的图片，其他域名将返回 400 错误。

---

#### 获取头像预设列表

- **路径**：`GET /api/account/avatar-presets`
- **描述**：获取系统内置和自定义头像预设列表。公开接口。
- **请求参数**：无
- **响应格式**：

  ```json
  {
    "avatars": [
      {
        "id": "preset_001",
        "label": "默认头像",
        "imageUrl": "/uploads/preset_001.png",
        "active": true,
        "sortOrder": 0,
        "builtIn": true,
        "createdAt": 1700000000000,
        "updatedAt": 1700000000000
      }
    ]
  }
  ```

---

#### 获取账户消息

- **路径**：`GET /api/account/messages`
- **描述**：获取当前用户的系统消息列表，包括支付、订阅、额度等通知。
- **请求参数**：无
- **响应格式**：

  ```json
  {
    "messages": [
      {
        "id": "msg_xxxxx",
        "userId": "u_xxxxx",
        "kind": "quota",
        "title": "额度不足提醒",
        "body": "您的今日对话次数已用完。",
        "metadata": {},
        "readAt": 0,
        "createdAt": 1784980000000
      }
    ],
    "unreadCount": 1
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | messages | AccountMessage[] | 消息列表 |
  | unreadCount | number | 未读消息数 |

- **错误码**：401（未认证）

- **关联数据表**：`account_messages`

---

#### 标记消息已读

- **路径**：`POST /api/account/messages/[id]/read`
- **描述**：将指定消息标记为已读。
- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | id | string | 是 | 消息 ID（路径参数） |

- **响应格式**：

  ```json
  {
    "ok": true
  }
  ```

- **错误码**：401（未认证）

- **关联数据表**：`account_messages`

---

#### 全部标记已读

- **路径**：`POST /api/account/messages/read-all`
- **描述**：将当前用户的所有消息标记为已读。
- **请求参数**：无
- **响应格式**：

  ```json
  {
    "ok": true
  }
  ```

- **错误码**：401（未认证）

- **关联数据表**：`account_messages`

---

### 管理模块（Admin）

> 以下所有接口均需管理员权限（role=admin）。

#### 管理后台摘要统计

- **路径**：`GET /api/admin/summary`
- **描述**：获取管理后台的完整摘要数据，包含用户统计、生成统计、系统配置、审计日志等全量数据。
- **请求参数**：无
- **响应格式**：

  ```json
  {
    "stats": {
      "users": 42,
      "activeAssets": 150,
      "generations": 1200,
      "failedGenerations": 30,
      "usageUnits": 3500,
      "totalCostCents": 50000
    },
    "users": [
      {
        "id": "u_xxxxx",
        "name": "用户A",
        "username": "user_a",
        "email": "",
        "phone": "138****8000",
        "role": "user",
        "plan": "pro",
        "status": "active",
        "configUsed": 10,
        "chatUsedToday": 3,
        "configRemaining": 40,
        "chatRemainingToday": 47,
        "createdAt": 1700000000000,
        "lastLoginAt": 1784980000000,
        "updatedAt": 1784980000000
      }
    ],
    "categories": [],
    "brands": [],
    "assets": [],
    "providers": [],
    "prompts": [],
    "promptTemplates": [],
    "avatarPresets": [],
    "classicPaints": [],
    "workflows": [],
    "guardrailConfig": { "id": "default", "..." : "..." },
    "chatSessions": [],
    "plans": [],
    "auditLogs": [],
    "badCases": [],
    "quotaAdjustments": [],
    "providerCosts": [],
    "generationFailures": [],
    "behaviorEvents": [],
    "smsRecords": [],
    "userProfiles": [],
    "generations": [],
    "usage": []
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | stats | object | 汇总统计 |
  | stats.users | number | 用户总数 |
  | stats.activeAssets | number | 活跃配件资产数 |
  | stats.generations | number | 生成总数 |
  | stats.failedGenerations | number | 失败生成数 |
  | stats.usageUnits | number | AI 调用总单位数 |
  | stats.totalCostCents | number | 总成本（分） |
  | users | array | 用户列表（含额度信息） |
  | generations | array | 生成记录列表 |
  | usage | array | 用量明细列表 |
  | categories | PartCategory[] | 配件分类 |
  | brands | PartBrand[] | 品牌 |
  | assets | PartAsset[] | 配件资产 |
  | providers | ProviderConfig[] | AI 提供商 |
  | plans | MembershipPlan[] | 套餐 |
  | workflows | WorkflowConfig[] | 工作流配置 |
  | guardrailConfig | GuardrailConfig | 安全配置 |
  | auditLogs | AuditLog[] | 审计日志 |
  | quotaAdjustments | AdminQuotaAdjustment[] | 额度调整记录 |
  | providerCosts | AdminProviderCostStat[] | 提供商成本统计 |
  | generationFailures | AdminGenerationFailure[] | 生成失败记录 |
  | smsRecords | AdminSmsRecord[] | 短信发送记录 |

- **错误码**：401（未认证）、403（非管理员）

---

#### 配件资产管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/assets` | 创建配件资产 |
| `PATCH` | `/api/admin/assets` | 批量排序配件资产 |
| `PATCH` | `/api/admin/assets/[id]` | 更新指定配件资产 |
| `DELETE` | `/api/admin/assets/[id]` | 删除指定配件资产 |

---

#### 品牌管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/brands` | 创建品牌 |
| `PATCH` | `/api/admin/brands` | 批量排序品牌 |
| `PATCH` | `/api/admin/brands/[id]` | 更新指定品牌 |
| `DELETE` | `/api/admin/brands/[id]` | 删除指定品牌 |

---

#### 分类管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/categories` | 创建配件分类 |
| `PATCH` | `/api/admin/categories` | 批量排序分类 |
| `PATCH` | `/api/admin/categories/[id]` | 更新指定分类 |
| `DELETE` | `/api/admin/categories/[id]` | 删除指定分类 |

---

#### 头像预设管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/avatar-presets` | 列出所有头像预设 |
| `POST` | `/api/admin/avatar-presets` | 创建头像预设 |
| `PATCH` | `/api/admin/avatar-presets/[id]` | 更新头像预设 |
| `DELETE` | `/api/admin/avatar-presets/[id]` | 删除头像预设 |

---

#### 经典车漆管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/classic-paints` | 列出所有经典车漆 |
| `POST` | `/api/admin/classic-paints` | 创建经典车漆 |
| `PATCH` | `/api/admin/classic-paints/[id]` | 更新经典车漆 |
| `DELETE` | `/api/admin/classic-paints/[id]` | 删除经典车漆 |

---

#### 安全配置管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/guardrail` | 获取安全检查配置 |
| `POST` | `/api/admin/guardrail` | 更新安全检查配置（SOP、关键词、推荐提示词等） |

---

#### 套餐管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/plans` | 更新/创建会员套餐 |

---

#### AI 提供商配置管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/provider-configs` | 更新 AI 提供商配置（API Key、模型、启用状态等） |

---

#### 额度调整

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/quota-adjustments` | 调整指定用户的额度（配置模式或对话模式） |

---

#### 图片上传

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/uploads` | 上传配件图片到素材库 |

---

#### 用户管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `PATCH` | `/api/admin/users/[id]` | 管理指定用户（修改角色、套餐、状态等） |

---

#### 订单管理

- **路径**：`GET /api/admin/orders`
- **描述**：查询所有用户的支付订单，支持多维度筛选。需要管理员权限。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | startDate | string | 否 | 起始日期（格式 `YYYY-MM-DD`） |
  | endDate | string | 否 | 截止日期（格式 `YYYY-MM-DD`） |
  | userQuery | string | 否 | 用户名或手机号模糊匹配 |
  | planId | string | 否 | 套餐 ID（`free` / `pro` / `max`） |

- **响应格式**：

  ```json
  {
    "orders": [
      {
        "id": "order_xxx",
        "userId": "user_xxx",
        "planId": "pro",
        "method": "wechat",
        "status": "paid",
        "amountCents": 2900,
        "createdAt": 1722200000000,
        "updatedAt": 1722200000000,
        "userName": "张三",
        "userPhone": "13800138000"
      }
    ]
  }
  ```

- **错误码**：401（未认证）、403（需要管理员权限）

---

#### 工作流配置管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/workflows` | 列出所有工作流配置 |
| `PUT` | `/api/admin/workflows` | 更新工作流配置 |

---

#### 提示词模板管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/prompt-templates` | 查询提示词模板，支持按 `scope` 参数过滤 |
| `POST` | `/api/admin/prompt-templates` | 405 - 只读，通过 Git Seed 管理 |
| `PATCH` | `/api/admin/prompt-templates` | 405 - 只读，通过 Git Seed 管理 |
| `PATCH` | `/api/admin/prompt-templates/[id]` | 405 - 只读，通过 Git Seed 管理 |
| `DELETE` | `/api/admin/prompt-templates/[id]` | 405 - 只读，通过 Git Seed 管理 |

---

#### 提示词预设管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/prompt-presets` | 405 - 只读，通过 Git Seed 管理 |

---

#### 生成记录分页列表

- **路径**：`GET /api/admin/generations`
- **描述**：分页查询生成记录列表，支持 6 维筛选（时间范围、生成模式、状态、AI 提供商、用户查询、配件分类）、3 维排序（创建时间/成本/耗时），并返回聚合统计信息。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | page | number | 否 | 页码，从 1 开始，默认 1 |
  | pageSize | number | 否 | 每页条数，默认 20 |
  | startDate | string | 否 | 起始日期（格式 `YYYY-MM-DD`） |
  | endDate | string | 否 | 截止日期（格式 `YYYY-MM-DD`） |
  | mode | string | 否 | 生成模式（`chat` / `config`） |
  | status | string | 否 | 生成状态（`succeeded` / `failed` / `pending`） |
  | providerId | string | 否 | AI 提供商 ID |
  | userQuery | string | 否 | 用户名或手机号模糊匹配 |
  | partCategory | string | 否 | 配件分类 ID 筛选 |
  | sortBy | string | 否 | 排序字段（`created_at` / `cost` / `duration`），默认 `created_at` |
  | sortOrder | string | 否 | 排序方向（`asc` / `desc`），默认 `desc` |

- **响应格式**：

  ```json
  {
    "items": [
      {
        "id": "gen_xxxxx",
        "status": "succeeded",
        "mode": "chat",
        "userId": "u_xxxxx",
        "username": "user_a",
        "phone": "138****8000",
        "provider": "fal-ai",
        "providerLabel": "fal.ai",
        "displayVehicleModel": "Tesla Model 3",
        "resultImageUrl": "/results/provider_xxx-gen_xxxxx.png",
        "promptSummary": "...",
        "costCents": 10,
        "durationMs": 5200,
        "retryCount": 0,
        "failureReason": "",
        "createdAt": 1784980000000
      }
    ],
    "total": 1200,
    "page": 1,
    "pageSize": 20,
    "stats": {
      "totalCount": 1200,
      "successRate": 0.95,
      "avgDurationMs": 4800,
      "avgCostCents": 12
    }
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | items | GenerationRecordItem[] | 当前页的生成记录列表 |
  | total | number | 符合筛选条件的总记录数 |
  | page | number | 当前页码 |
  | pageSize | number | 每页条数 |
  | stats | GenerationListStats | 聚合统计信息 |
  | stats.totalCount | number | 总记录数 |
  | stats.successRate | number | 成功率（0~1） |
  | stats.avgDurationMs | number | 平均耗时（毫秒） |
  | stats.avgCostCents | number | 平均成本（分） |

- **错误码**：401（未认证）、403（非管理员）

- **关联数据表**：`generation_jobs`

---

#### 生成记录详情

- **路径**：`GET /api/admin/generations/[id]`
- **描述**：获取指定生成记录的完整详情，包括解析后的进度时间线（progressJson）、标准化 JSON、车辆信息、结果校验以及重试子记录。
- **路径参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | id | string | 是 | 生成记录 ID |

- **响应格式**：

  ```json
  {
    "id": "gen_xxxxx",
    "status": "succeeded",
    "mode": "chat",
    "userId": "u_xxxxx",
    "username": "user_a",
    "phone": "138****8000",
    "provider": "fal-ai",
    "providerLabel": "fal.ai",
    "vehicleUploadId": "upload_xxxxx",
    "sourceImageUrl": "/uploads/vehicle-gen_xxxxx.jpg",
    "displayVehicleModel": "Tesla Model 3",
    "resultImageUrl": "/results/provider_xxx-gen_xxxxx.png",
    "paintId": "p_xxxxx",
    "stance": 0,
    "selections": {},
    "selectionOptions": {},
    "standardJson": { "...": "..." },
    "vehicleInfo": {
      "model": "Tesla Model 3",
      "view": "front_left",
      "confidence": 0.95
    },
    "progressSteps": [
      { "step": "vehicle_recognition", "message": "识别车辆中...", "elapsedMs": 1200, "completedAt": "2026-07-29T10:00:01.200Z" },
      { "step": "part_recognition", "message": "识别配件中...", "elapsedMs": 2400, "completedAt": "2026-07-29T10:00:02.400Z" },
      { "step": "image_generation", "message": "图片生成中...", "elapsedMs": 5200, "completedAt": "2026-07-29T10:00:05.200Z" }
    ],
    "resultCheck": { "passed": true, "score": 85, "...": "..." },
    "retryCount": 0,
    "failureReason": "",
    "costCents": 10,
    "badCaseTags": [],
    "usageUnits": 1,
    "createdAt": 1784980000000,
    "retryChildren": [
      {
        "id": "gen_yyyyy",
        "status": "succeeded",
        "retryCount": 1,
        "createdAt": 1784980100000
      }
    ]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | progressSteps | ProgressStep[] | 解析 progressJson 后的时间线步骤列表 |
  | vehicleInfo | object | 车辆识别信息 |
  | resultCheck | object or null | 结果校验结果 |
  | retryChildren | GenerationRecordItem[] | 该记录的所有重试子记录 |

- **错误码**：401（未认证）、403（非管理员）、404（记录不存在）

- **关联数据表**：`generation_jobs`

---

#### 重试生成任务

- **路径**：`POST /api/admin/generations/[id]/retry`
- **描述**：使用原始任务参数快速重试一个生成任务。创建新的生成任务并将 `retryCount` 递增，同时写入审计日志。
- **路径参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | id | string | 是 | 原始生成记录 ID |

- **请求参数**：无（自动从原记录提取任务参数）
- **响应格式**：

  ```json
  {
    "ok": true,
    "jobId": "gen_yyyyy"
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | ok | boolean | 是否发起成功 |
  | jobId | string | 新创建的生成任务 ID |

- **错误码**：401（未认证）、403（非管理员）、404（原始记录不存在）

- **关联数据表**：`generation_jobs`、`audit_logs`

---

#### 生成记录 CSV 导出

- **路径**：`GET /api/admin/generations/export`
- **描述**：将生成记录以 CSV 格式导出，支持与列表接口相同的筛选条件。返回 `text/csv` 格式，带 BOM 头以兼容 Excel 中文显示。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | startDate | string | 否 | 起始日期（格式 `YYYY-MM-DD`） |
  | endDate | string | 否 | 截止日期（格式 `YYYY-MM-DD`） |
  | mode | string | 否 | 生成模式（`chat` / `config`） |
  | status | string | 否 | 生成状态 |
  | providerId | string | 否 | AI 提供商 ID |
  | userQuery | string | 否 | 用户名或手机号模糊匹配 |
  | partCategory | string | 否 | 配件分类 ID 筛选 |

- **响应格式**：

  ```
  Content-Type: text/csv; charset=utf-8
  Content-Disposition: attachment; filename="generations_2026-07-29.csv"
  ```

- **错误码**：401（未认证）、403（非管理员）

- **关联数据表**：`generation_jobs`

---

### 数据分析模块（Analytics）

> 以下所有接口均需管理员权限（role=admin）。

#### 生成数量趋势

- **路径**：`GET /api/admin/analytics/generations/trend`
- **描述**：查询生成数量的时间序列趋势数据，支持按小时/天/周/月粒度聚合，并可按生成模式分组。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | granularity | string | 否 | 聚合粒度（`hour` / `day` / `week` / `month`），默认 `day` |
  | days | number | 否 | 查询天数窗口，默认 30 |
  | mode | string | 否 | 生成模式过滤（`chat` / `config`），为空则返回全部模式汇总 |

- **响应格式**：

  ```json
  {
    "points": [
      {
        "date": "2026-07-29",
        "count": 42,
        "mode": "chat"
      },
      {
        "date": "2026-07-29",
        "count": 18,
        "mode": "config"
      }
    ]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | points | AnalyticsTimeseriesPoint[] | 时间序列数据点数组 |
  | points[].date | string | 时间维度标签（根据 granularity 不同格式不同） |
  | points[].count | number | 该时间点的生成数量 |
  | points[].mode | string | 生成模式（当未指定 mode 参数时按模式分组返回） |

- **错误码**：401（未认证）、403（非管理员）

---

#### 用户注册趋势

- **路径**：`GET /api/admin/analytics/users/registration-trend`
- **描述**：查询用户注册数量的时间序列趋势数据，包含上一周期对比数据（上期数量、变化率）。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | granularity | string | 否 | 聚合粒度（`hour` / `day` / `week` / `month`），默认 `day` |
  | days | number | 否 | 查询天数窗口，默认 30 |

- **响应格式**：

  ```json
  {
    "points": [
      { "date": "2026-07-28", "count": 5 },
      { "date": "2026-07-29", "count": 8 }
    ],
    "previousPeriodCount": 96,
    "currentPeriodCount": 120,
    "changeRate": 0.25
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | points | object[] | 时间序列数据点数组 |
  | points[].date | string | 时间维度标签 |
  | points[].count | number | 该时间点的注册数量 |
  | previousPeriodCount | number | 上一个等长周期的总注册数 |
  | currentPeriodCount | number | 当前周期的总注册数 |
  | changeRate | number | 环比变化率（正值为增长，负值为下降） |

- **错误码**：401（未认证）、403（非管理员）

---

#### 用户活跃度（DAU/WAU/MAU）

- **路径**：`GET /api/admin/analytics/users/activity`
- **描述**：查询 DAU（日活）、WAU（周活）、MAU（月活）时间序列数据。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | granularity | string | 否 | 聚合粒度（`hour` / `day` / `week` / `month`），默认 `day` |
  | days | number | 否 | 查询天数窗口，默认 30 |

- **响应格式**：

  ```json
  {
    "series": [
      { "date": "2026-07-29", "dau": 15, "wau": 42, "mau": 68 }
    ],
    "currentDau": 15,
    "currentWau": 42,
    "currentMau": 68
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | series | object[] | 时间序列数据数组 |
  | series[].date | string | 时间维度标签 |
  | series[].dau | number | 日活跃用户数 |
  | series[].wau | number | 周活跃用户数（截至该日） |
  | series[].mau | number | 月活跃用户数（截至该日） |
  | currentDau | number | 最新 DAU |
  | currentWau | number | 最新 WAU |
  | currentMau | number | 最新 MAU |

- **错误码**：401（未认证）、403（非管理员）

---

#### 用户留存率

- **路径**：`GET /api/admin/analytics/users/retention`
- **描述**：查询用户留存率的群组（Cohort）数据，按注册日期分组并计算指定周期的留存率。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | days | number | 否 | 查询天数窗口，默认 30 |
  | periods | string | 否 | 留存周期列表（逗号分隔），如 `1,7,30`，默认 `1,7,30` |

- **响应格式**：

  ```json
  {
    "cohorts": [
      {
        "cohortDate": "2026-07-01",
        "registerCount": 50,
        "retention": {
          "1": 0.6,
          "7": 0.3,
          "30": 0.1
        }
      },
      {
        "cohortDate": "2026-07-15",
        "registerCount": 40,
        "retention": {
          "1": 0.55,
          "7": 0.25
        }
      }
    ],
    "periods": ["1", "7", "30"]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | cohorts | object[] | 群组数据数组 |
  | cohorts[].cohortDate | string | 群组注册日期 |
  | cohorts[].registerCount | number | 该群组的注册用户数 |
  | cohorts[].retention | object | 各周期的留存率映射，键为天数，值为留存率（0~1） |
  | periods | string[] | 当前查询的留存周期列表 |

- **错误码**：401（未认证）、403（非管理员）

---

#### 活跃用户列表

- **路径**：`GET /api/admin/analytics/users/active-list`
- **描述**：查询指定日期的活跃用户列表。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | date | string | 否 | 查询日期（格式 `YYYY-MM-DD`），默认当天 |

- **响应格式**：

  ```json
  {
    "items": [
      {
        "userId": "u_xxxxx",
        "username": "user_a",
        "name": "用户A",
        "phone": "138****8000",
        "plan": "pro",
        "lastActiveAt": "2026-07-29T10:30:00.000Z"
      }
    ]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | items | ActiveUserItem[] | 活跃用户列表 |
  | items[].userId | string | 用户 ID |
  | items[].username | string | 用户名 |
  | items[].name | string | 显示名称 |
  | items[].phone | string | 手机号（脱敏） |
  | items[].plan | string | 当前套餐 ID |
  | items[].lastActiveAt | string | 最后活跃时间（ISO 8601） |

- **错误码**：401（未认证）、403（非管理员）

---

### 用户管理模块（Admin Users）

> 以下所有接口均需管理员权限（role=admin）。GET 和 PATCH `/api/admin/users/[id]` 共存于同一资源路径。

#### 用户详情（聚合数据）

- **路径**：`GET /api/admin/users/[id]`
- **描述**：获取指定用户的聚合详情数据，包含用户基本信息、计费信息、标签（自动标签 + 手动标签）、使用时间线、生成记录概览、偏好设置及审计日志。与现有 `PATCH /api/admin/users/[id]` 共存。
- **路径参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | id | string | 是 | 用户 ID |

- **响应格式**：

  ```json
  {
    "user": {
      "id": "u_xxxxx",
      "username": "user_a",
      "name": "用户A",
      "email": "user@example.com",
      "phone": "13800138000",
      "role": "user",
      "plan": "pro",
      "status": "active",
      "createdAt": 1700000000000,
      "lastLoginAt": 1784980000000,
      "updatedAt": 1784980000000
    },
    "billing": {
      "plan": { "id": "pro", "label": "Pro", "...": "..." },
      "configUsed": 10,
      "chatUsedToday": 3,
      "configRemaining": 40,
      "chatRemainingToday": 47,
      "chatEnabled": true
    },
    "tags": {
      "auto": ["high_value"],
      "manual": ["vip"]
    },
    "usageTimeline": [
      { "date": "2026-07-28", "configCount": 2, "chatCount": 5 }
    ],
    "generations": [
      { "id": "gen_xxxxx", "status": "succeeded", "createdAt": 1784980000000 }
    ],
    "generationTotal": 120,
    "preferences": {
      "language": "zh-CN",
      "responseLanguage": "zh-CN"
    },
    "auditLogs": [
      {
        "id": "log_xxxxx",
        "action": "user.update",
        "details": { "...": "..." },
        "createdAt": 1784980000000
      }
    ]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | user | object | 用户基本信息 |
  | billing | object | 计费与额度信息 |
  | tags | object | 用户标签（auto: 系统自动标记，manual: 管理员手动标记） |
  | tags.auto | string[] | 自动标签列表 |
  | tags.manual | string[] | 手动标签列表 |
  | usageTimeline | object[] | 近期使用时间线 |
  | generations | object[] | 最近生成记录（概览） |
  | generationTotal | number | 生成总数 |
  | preferences | object | 用户偏好设置 |
  | auditLogs | object[] | 该用户的审计日志 |

- **错误码**：401（未认证）、403（非管理员）、404（用户不存在）

- **关联数据表**：`users`、`generation_jobs`、`audit_logs`

---

#### 更新用户手动标签

- **路径**：`PATCH /api/admin/users/[id]/tags`
- **描述**：更新指定用户的手动标签，覆盖写入并记录审计日志。
- **路径参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | id | string | 是 | 用户 ID |

- **请求参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | tags | string[] | 是 | 手动标签列表，传入新数组将覆盖原有标签 |

- **请求示例**：

  ```json
  {
    "tags": ["vip", "high_value"]
  }
  ```

- **响应格式**：

  ```json
  {
    "ok": true,
    "tags": ["vip", "high_value"]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | ok | boolean | 是否更新成功 |
  | tags | string[] | 更新后的手动标签列表 |

- **错误码**：401（未认证）、403（非管理员）、404（用户不存在）

- **关联数据表**：`users`、`audit_logs`

---

#### 用户列表 CSV 导出

- **路径**：`GET /api/admin/users/export`
- **描述**：将用户列表以 CSV 格式导出。返回 `text/csv` 格式，带 BOM 头以兼容 Excel 中文显示。
- **查询参数**：无
- **响应格式**：

  ```
  Content-Type: text/csv; charset=utf-8
  Content-Disposition: attachment; filename="users_2026-07-29.csv"
  ```

  CSV 列定义：

  | 列名 | 描述 |
  |------|------|
  | Username | 用户名 |
  | Phone | 手机号 |
  | Plan | 当前套餐 |
  | Role | 用户角色 |
  | Registered At | 注册时间 |
  | Last Login | 最后登录时间 |
  | Tags | 用户标签（逗号分隔） |

- **错误码**：401（未认证）、403（非管理员）

- **关联数据表**：`users`

---

#### 失败率趋势

- **路径**：`GET /api/admin/analytics/failures/trend`
- **描述**：查询生成任务失败率的时间序列趋势，支持按生成模式或 Provider 分组，并自动检测异常日期（失败率超过历史均值 2 倍标准差）。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | days | number | 否 | 查询天数窗口，默认 7 |
  | granularity | string | 否 | 聚合粒度（`hour` / `day` / `week` / `month`），默认 `day` |
  | groupBy | string | 否 | 分组维度（`none` / `mode` / `provider`），默认 `none` |

- **响应格式**：

  ```json
  {
    "points": [
      { "date": "2026-07-29", "total": 100, "failed": 5, "failureRate": 5.0, "group": "chat" }
    ],
    "anomalyDates": ["2026-07-28"]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | points | FailureTrendPoint[] | 时间序列数据点 |
  | points[].date | string | 日期标签 |
  | points[].total | number | 该时段总生成数 |
  | points[].failed | number | 该时段失败数 |
  | points[].failureRate | number | 失败率（百分比） |
  | points[].group | string | 分组标签（groupBy=none 时省略） |
  | anomalyDates | string[] | 异常日期列表 |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`generation_jobs`

---

#### Provider 失败率排名

- **路径**：`GET /api/admin/analytics/failures/provider-ranking`
- **描述**：查询各 Provider 的失败率排名及 Top 失败原因关键词。
- **查询参数**：无
- **响应格式**：

  ```json
  {
    "rankings": [
      { "provider": "doubao", "requestCount": 500, "failureCount": 25, "failureRate": 5.0, "topReasons": ["timeout", "content_filter"] }
    ]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | rankings | ProviderFailureRanking[] | Provider 排名列表（按失败率降序） |
  | rankings[].provider | string | Provider ID |
  | rankings[].requestCount | number | 总请求数 |
  | rankings[].failureCount | number | 失败请求数 |
  | rankings[].failureRate | number | 失败率（百分比） |
  | rankings[].topReasons | string[] | Top 失败原因关键词（最多 5 个） |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`generation_jobs`

---

#### 成本趋势

- **路径**：`GET /api/admin/analytics/costs/trend`
- **描述**：查询 Provider 调用成本的时间序列趋势，支持按 Provider 分组。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | days | number | 否 | 查询天数窗口，默认 7 |
  | granularity | string | 否 | 聚合粒度，默认 `day` |
  | groupByProvider | boolean | 否 | 是否按 Provider 分组，默认 false |

- **响应格式**：

  ```json
  {
    "points": [
      { "date": "2026-07-29", "count": 1250, "group": "doubao" }
    ]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | points | AnalyticsTimeseriesPoint[] | 时间序列数据点 |
  | points[].date | string | 日期标签 |
  | points[].count | number | 该时段成本（单位：分） |
  | points[].group | string | Provider 名称（groupByProvider=true 时存在） |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`generation_jobs`（cost_cents 字段）

---

#### 按用户成本排名

- **路径**：`GET /api/admin/analytics/costs/by-user`
- **描述**：查询成本最高的用户排名。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | limit | number | 否 | 返回条目数，默认 10 |

- **响应格式**：

  ```json
  {
    "items": [
      { "userId": "abc123", "username": "user1", "totalCostCents": 50000 }
    ]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | items | CostByUserItem[] | 用户成本排名列表（按成本降序） |
  | items[].userId | string | 用户 ID |
  | items[].username | string | 用户名 |
  | items[].totalCostCents | number | 总成本（单位：分） |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`generation_jobs`、`users`

---

#### 按配件类别成本

- **路径**：`GET /api/admin/analytics/costs/by-category`
- **描述**：查询各配件类别的成本占比。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | days | number | 否 | 查询天数窗口，默认 7 |

- **响应格式**：

  ```json
  {
    "items": [
      { "category": "wheels", "totalCostCents": 30000 }
    ]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | items | CostByCategoryItem[] | 类别成本列表 |
  | items[].category | string | 配件类别 ID |
  | items[].totalCostCents | number | 该类别总成本（单位：分） |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`generation_jobs`

---

#### 单次生成成本分布

- **路径**：`GET /api/admin/analytics/costs/distribution`
- **描述**：查询单次生成成本的分桶分布及百分位数（P50/P90/P99）。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | days | number | 否 | 查询天数窗口，默认 7 |

- **响应格式**：

  ```json
  {
    "buckets": [
      { "range": "0-10", "count": 150 },
      { "range": "10-20", "count": 80 }
    ],
    "p50": 12,
    "p90": 25,
    "p99": 50
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | buckets | CostBucket[] | 成本分桶列表 |
  | buckets[].range | string | 分桶范围标签 |
  | buckets[].count | number | 该桶内记录数 |
  | p50 | number | 中位数成本（单位：分） |
  | p90 | number | 90 百分位成本 |
  | p99 | number | 99 百分位成本 |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`generation_jobs`

---

#### 收入趋势

- **路径**：`GET /api/admin/analytics/orders/revenue-trend`
- **描述**：查询收入的时间序列趋势，并返回当日收入、月度收入和 ARPU 概览。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | days | number | 否 | 查询天数窗口，默认 7 |
  | granularity | string | 否 | 聚合粒度，默认 `day` |

- **响应格式**：

  ```json
  {
    "points": [
      { "date": "2026-07-29", "count": 9900 }
    ],
    "dailyRevenue": 9900,
    "monthlyRevenue": 198000,
    "arpu": 3300
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | points | AnalyticsTimeseriesPoint[] | 时间序列数据点 |
  | points[].date | string | 日期标签 |
  | points[].count | number | 该时段收入（单位：分） |
  | dailyRevenue | number | 当日收入（分） |
  | monthlyRevenue | number | 当月收入（分） |
  | arpu | number | 每付费用户平均收入（分） |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`payment_orders`

---

#### 订单转化率

- **路径**：`GET /api/admin/analytics/orders/conversion`
- **描述**：查询付费转化率、订单状态分布及退款率趋势。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | days | number | 否 | 查询天数窗口，默认 7 |

- **响应格式**：

  ```json
  {
    "conversionRate": 15.5,
    "totalUsers": 1000,
    "paidUsers": 155,
    "statusDistribution": [
      { "status": "paid", "count": 155 },
      { "status": "pending", "count": 20 }
    ],
    "refundRateSeries": [
      { "date": "2026-07-29", "rate": 2.5 }
    ]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | conversionRate | number | 付费转化率（百分比） |
  | totalUsers | number | 总用户数 |
  | paidUsers | number | 付费用户数 |
  | statusDistribution | OrderStatusCount[] | 订单状态分布 |
  | statusDistribution[].status | string | 订单状态 |
  | statusDistribution[].count | number | 该状态订单数 |
  | refundRateSeries | Array | 退款率时间序列 |
  | refundRateSeries[].date | string | 日期 |
  | refundRateSeries[].rate | number | 退款率（百分比） |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`payment_orders`、`users`

---

#### 续费率

- **路径**：`GET /api/admin/analytics/orders/renewal`
- **描述**：查询订阅续费率趋势及当前整体续费率。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | days | number | 否 | 查询天数窗口，默认 90 |

- **响应格式**：

  ```json
  {
    "currentRate": 65.0,
    "series": [
      { "month": "2026-07", "rate": 65.0, "expired": 100, "renewed": 65 }
    ]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | currentRate | number | 当前整体续费率（百分比） |
  | series | RenewalRatePoint[] | 月度续费率趋势 |
  | series[].month | string | 月份 |
  | series[].rate | number | 该月续费率（百分比） |
  | series[].expired | number | 该月到期订阅数 |
  | series[].renewed | number | 该月续费订阅数 |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`subscriptions`

---

#### 额度消耗趋势

- **路径**：`GET /api/admin/analytics/quota/consumption-trend`
- **描述**：查询额度消耗和额度调整的时间序列趋势（双序列）。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | days | number | 否 | 查询天数窗口，默认 7 |
  | granularity | string | 否 | 聚合粒度，默认 `day` |

- **响应格式**：

  ```json
  {
    "consumptionSeries": [
      { "date": "2026-07-29", "count": 500 }
    ],
    "adjustmentSeries": [
      { "date": "2026-07-29", "count": 100 }
    ]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | consumptionSeries | AnalyticsTimeseriesPoint[] | 额度消耗序列 |
  | adjustmentSeries | AnalyticsTimeseriesPoint[] | 额度调整序列 |
  | series[].date | string | 日期标签 |
  | series[].count | number | 该时段额度变动量 |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`usage_ledger`、`quota_adjustments`

---

#### 额度余额分布

- **路径**：`GET /api/admin/analytics/quota/balance-distribution`
- **描述**：查询用户额度余额的分布情况（已耗尽 / 即将耗尽 / 充足）。
- **查询参数**：无
- **响应格式**：

  ```json
  {
    "exhausted": 10,
    "nearExhausted": 25,
    "sufficient": 165,
    "total": 200
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | exhausted | number | 已耗尽用户数（剩余额度 = 0） |
  | nearExhausted | number | 即将耗尽用户数（剩余额度 < 20% 上限） |
  | sufficient | number | 充足用户数 |
  | total | number | 总用户数 |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`entitlement_usage`、`membership_plans`

---

#### 告警列表

- **路径**：`GET /api/admin/analytics/alerts`
- **描述**：查询异常告警记录列表，支持按状态筛选。每次请求会触发一次告警扫描。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | status | string | 否 | 状态筛选（`pending` / `confirmed` / `ignored`） |
  | limit | number | 否 | 返回条目数，默认 50 |

- **响应格式**：

  ```json
  {
    "alerts": [
      {
        "id": "alert_001",
        "userId": "abc123",
        "username": "user1",
        "alertType": "high_frequency",
        "alertValue": 150,
        "detectedAt": 1722240000000,
        "status": "pending",
        "resolvedAt": null,
        "resolverId": null
      }
    ],
    "total": 1,
    "scannedAt": 1722240000000
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | alerts | AlertRecord[] | 告警记录列表 |
  | alerts[].id | string | 告警 ID |
  | alerts[].userId | string | 用户 ID |
  | alerts[].username | string | 用户名 |
  | alerts[].alertType | string | 告警类型（`high_frequency` / `high_cost`） |
  | alerts[].alertValue | number | 触发值（频率次数或成本分） |
  | alerts[].detectedAt | number | 检测时间戳 |
  | alerts[].status | string | 状态（`pending` / `confirmed` / `ignored`） |
  | alerts[].resolvedAt | number\|null | 处理时间戳 |
  | alerts[].resolverId | string\|null | 处理人 ID |
  | total | number | 总告警数 |
  | scannedAt | number | 最后扫描时间戳 |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`alert_records`

---

#### 更新告警状态

- **路径**：`PATCH /api/admin/analytics/alerts/[id]`
- **描述**：确认或忽略一条告警记录。
- **路径参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | id | string | 是 | 告警记录 ID |

- **请求体**：

  ```json
  { "status": "confirmed" }
  ```

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | status | string | 是 | 目标状态（`confirmed` / `ignored`） |

- **响应格式**：

  ```json
  {
    "alert": {
      "id": "alert_001",
      "userId": "abc123",
      "username": "user1",
      "alertType": "high_frequency",
      "alertValue": 150,
      "detectedAt": 1722240000000,
      "status": "confirmed",
      "resolvedAt": 1722240100000,
      "resolverId": "admin_001"
    }
  }
  ```

- **错误码**：400（无效状态值）、401（未认证）、403（非管理员）、404（告警不存在）
- **关联数据表**：`alert_records`

---

#### 失败归因分析

- **路径**：`GET /api/admin/analytics/failures/attribution`
- **描述**：查询生成失败记录的归因分类分布，基于 `failure_reason` 关键词匹配自动分类。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | days | number | 否 | 查询天数窗口，默认 30 |
  | provider | string | 否 | Provider 筛选 |
  | mode | string | 否 | 生成模式筛选（`config` / `chat`） |

- **响应格式**：

  ```json
  {
    "items": [
      { "category": "Provider timeout", "count": 45, "percentage": 30.0 }
    ],
    "total": 150
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | items | FailureAttributionItem[] | 归因分类列表（按数量降序） |
  | items[].category | string | 归因类别名称 |
  | items[].count | number | 该类失败数量 |
  | items[].percentage | number | 占比（百分比） |
  | total | number | 失败总数 |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`generation_jobs`

---

#### API 成功率监控

- **路径**：`GET /api/admin/analytics/health/success-rate`
- **描述**：按时间粒度查询各 Provider 的 API 成功率趋势。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | hours | number | 否 | 查询小时数，默认 24 |
  | granularity | string | 否 | 聚合粒度，默认 `hour` |
  | provider | string | 否 | Provider 筛选 |

- **响应格式**：

  ```json
  {
    "points": [
      { "date": "2026-07-29 14:00", "provider": "openai", "successRate": 98.5, "total": 200, "succeeded": 197 }
    ]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | points | SuccessRatePoint[] | 成功率数据点 |
  | points[].date | string | 时间标签 |
  | points[].provider | string | Provider 名称 |
  | points[].successRate | number | 成功率（百分比） |
  | points[].total | number | 总请求数 |
  | points[].succeeded | number | 成功请求数 |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`generation_jobs`

---

#### 响应时间监控

- **路径**：`GET /api/admin/analytics/health/latency`
- **描述**：按时间粒度查询生成任务的 P50/P95/P99 延迟分位数趋势。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | hours | number | 否 | 查询小时数，默认 24 |
  | granularity | string | 否 | 聚合粒度，默认 `hour` |
  | provider | string | 否 | Provider 筛选 |

- **响应格式**：

  ```json
  {
    "points": [
      { "date": "2026-07-29 14:00", "provider": "openai", "p50": 1200, "p95": 3500, "p99": 5200 }
    ]
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | points | LatencyPoint[] | 延迟数据点 |
  | points[].date | string | 时间标签 |
  | points[].provider | string | Provider 名称 |
  | points[].p50 | number | P50 延迟（毫秒） |
  | points[].p95 | number | P95 延迟（毫秒） |
  | points[].p99 | number | P99 延迟（毫秒） |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`generation_jobs`

---

#### 队列积压监控

- **路径**：`GET /api/admin/analytics/health/queue`
- **描述**：实时查询当前生成任务队列状态（queued / running）。
- **查询参数**：无
- **响应格式**：

  ```json
  { "queued": 5, "running": 3, "alert": false }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | queued | number | 排队中任务数 |
  | running | number | 运行中任务数 |
  | alert | boolean | 是否超过积压阈值（>20） |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`generation_jobs`

---

#### 质量评分趋势

- **路径**：`GET /api/admin/analytics/quality/score-trend`
- **描述**：按时间粒度查询生成结果质量评分的日均趋势。评分来源于 `result_check.score`。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | days | number | 否 | 查询天数窗口，默认 30 |
  | granularity | string | 否 | 聚合粒度，默认 `day` |

- **响应格式**：

  ```json
  {
    "points": [
      { "date": "2026-07-29", "avgScore": 82.5, "minScore": 60, "maxScore": 95, "count": 120 }
    ],
    "threshold": 70
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | points | QualityScorePoint[] | 评分趋势数据点 |
  | points[].date | string | 日期标签 |
  | points[].avgScore | number | 平均评分 |
  | points[].minScore | number | 最低评分 |
  | points[].maxScore | number | 最高评分 |
  | points[].count | number | 采样数 |
  | threshold | number | 告警阈值 |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`generation_jobs`

---

#### Bad Case 处理效率

- **路径**：`GET /api/admin/analytics/quality/bad-cases`
- **描述**：查询 Bad Case 的处理效率统计，包括平均处理时长、已处理/未处理数量趋势。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | days | number | 否 | 查询天数窗口，默认 30 |
  | granularity | string | 否 | 聚合粒度，默认 `day` |

- **响应格式**：

  ```json
  {
    "points": [
      { "date": "2026-07-29", "avgProcessTimeMs": 3600000, "processed": 12, "unprocessed": 3 }
    ],
    "totalProcessed": 120,
    "totalUnprocessed": 15,
    "overallAvgTimeMs": 4200000
  }
  ```

- **响应字段说明**：

  | 字段 | 类型 | 描述 |
  |------|------|------|
  | points | BadCaseEfficiencyPoint[] | 处理效率趋势 |
  | points[].date | string | 日期标签 |
  | points[].avgProcessTimeMs | number | 平均处理时长（毫秒） |
  | points[].processed | number | 已处理数量 |
  | points[].unprocessed | number | 未处理数量 |
  | totalProcessed | number | 总已处理数量 |
  | totalUnprocessed | number | 总未处理数量 |
  | overallAvgTimeMs | number | 整体平均处理时长（毫秒） |

- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`generation_bad_cases`

---

#### 用户消息广播

- **路径**：`POST /api/admin/messages/broadcast`
- **描述**：向指定用户群体批量发送系统消息，消息写入 `account_messages` 表。
- **请求体**：

  ```json
  {
    "title": "System Maintenance Notice",
    "body": "We will perform maintenance at 02:00 UTC.",
    "target": "all",
    "planId": "pro",
    "tag": "vip",
    "userIds": ["user_1", "user_2"]
  }
  ```

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | title | string | 是 | 消息标题 |
  | body | string | 是 | 消息内容 |
  | target | string | 是 | 目标类型（`all` / `plan` / `tag` / `users`） |
  | planId | string | 否* | 套餐 ID（target=`plan` 时必填） |
  | tag | string | 否* | 用户标签（target=`tag` 时必填） |
  | userIds | string[] | 否* | 用户 ID 列表（target=`users` 时必填） |

- **响应格式**：

  ```json
  { "sent": 150 }
  ```

- **错误码**：400（参数错误）、401（未认证）、403（非管理员）
- **关联数据表**：`account_messages`、`users`、`user_tags`

---

#### 数据报表导出

- **路径**：`GET /api/admin/reports/generate`
- **描述**：生成运营数据报表并导出为 CSV。支持日报（近 24 小时，按小时）、周报（近 7 天，按天）、月报（近 30 天，按天）。
- **查询参数**：

  | 参数名 | 类型 | 必填 | 描述 |
  |--------|------|------|------|
  | type | string | 否 | 报表类型（`daily` / `weekly` / `monthly`），默认 `daily` |

- **响应格式**：`text/csv` 文件下载，带 UTF-8 BOM 头
- **CSV 列**：Date / New Users / Total Generations / Success Rate (%) / Revenue (USD) / Cost (USD)
- **错误码**：401（未认证）、403（非管理员）
- **关联数据表**：`users`、`generation_jobs`、`payment_orders`、`usage_ledger`

---

> 最后更新时间：2026-07-30
> 关联方案ID：DESIGN-20260729-001、DESIGN-20260729-002、DESIGN-20260729-003、DESIGN-20260730-001

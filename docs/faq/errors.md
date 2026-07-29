# 错误与异常 常见问题

## Q：生成任务一直处于 running 状态，未返回结果
**现象**：用户提交生成请求后，进度条卡在某个步骤不再推进，任务始终为 running 状态。

**根因**：上游 AI Provider 响应超时或返回不可解析的响应。生成引擎未正确处理超时场景。

**解决方案**：
1. 刷新页面重新加载应用。
2. 在管理后台 "Bad Case" 模块中检查是否有对应的失败记录。
3. 在管理后台 "Provider" 模块中检查 Provider 状态和 API Key 有效性。
4. 如 Provider 服务确实异常，切换到备用 Provider 或等待服务恢复。
5. 用户可在 "车库" 中查看历史记录，失败的生成不计积分。

---

## Q：上传图片提示"文件类型不支持"
**现象**：用户上传车辆图片或配件参考图时，系统提示文件类型不支持。

**根因**：系统仅支持 JPEG、PNG、WebP 三种图片格式。用户上传了 BMP、TIFF、GIF 等不支持的格式。

**解决方案**：
1. 使用图片编辑工具将图片转换为 JPEG、PNG 或 WebP 格式。
2. 确认文件扩展名与实际文件格式一致（避免仅改扩展名但文件内容不变）。
3. 重新上传转换后的图片。

---

## Q：聊天模式下意图解析失败，返回空白或错误响应
**现象**：用户在聊天模式中描述改装需求后，AI 返回"无法理解"或无生成结果。

**根因**：本地意图解析器（关键词匹配 + 规则引擎）未能匹配用户输入，且 LLM fallback 也未能提取有效意图。可能原因包括：用户描述过于模糊、使用了系统未识别的配件别名、或 LLM Provider 不可用。

**解决方案**：
1. 尝试使用更具体的改装描述，包含配件类别关键词（如"轮毂"、"卡钳"、"尾翼"等）。
2. 同时上传配件参考图，帮助系统识别配件类型。
3. 如持续失败，检查管理后台中 LLM Provider 是否配置正确且可用。
4. 在 `lib/part-category-aliases.ts` 中检查是否缺少相关别名配置，如有需要可提交扩展。

---

## Q：碳纤维配件生成时未询问颜色策略
**现象**：在聊天模式中选择碳纤维配件（如碳纤维机盖）时，系统未询问颜色策略（车身同色/裸碳），直接使用默认策略生成。

**根因**：配件的 `color_policy` 字段未正确设置为 `exposed_carbon`，或意图解析器未识别到碳纤维关键词。

**解决方案**：
1. 管理员在管理后台 "资源库" 模块中检查该配件的 `color_policy` 字段。
2. 确认碳纤维类配件的 `color_policy` 已设置为 `exposed_carbon`。
3. 保存后重新测试。

---

## Q：position:fixed 元素未相对于浏览器视口定位，而是贴在父容器边缘
**现象**：PC 端浮动菜单（`.app-floating-rail`）设置了 `position: fixed; left: 0`，但菜单并未贴到浏览器窗口最左侧，而是贴在 `.studio-card` 容器的左边缘（即"黑色操作区"的左边缘）。

**根因**：CSS 规范规定，当祖先元素设置了 `backdrop-filter`（或 `transform`、`filter`、`perspective` 等属性）时，会创建一个新的包含块（containing block）。此时后代的 `position: fixed` 不再相对于浏览器视口定位，而是相对于该祖先元素定位。`.studio-card` 设置了 `backdrop-filter: blur(8px)`，导致菜单的 `left: 0` 实际上是相对于 `.studio-card` 的左边缘。

**解决方案**：
1. 将 `position: fixed` 的菜单元素从设有 `backdrop-filter` 的 `.studio-card` 内部移出，放到没有该属性的 `.app-shell`（`<main>` 元素）直接子级。
2. 确保菜单的所有祖先元素（直到视口）都没有 `backdrop-filter`、`transform`、`filter`、`perspective` 等会创建包含块的属性。
3. 修改 `components/car-mod-studio.tsx`，将 `<nav className="app-floating-rail">` 移到 `<div className="studio-card">` 之前。

**关联方案ID**：DESIGN-20260728-001

---

## Q：PC端个人中心"我的订单"一直显示"正在加载"
**现象**：用户在 PC 端打开个人中心，点击"我的订单"后，页面持续显示"正在加载订单..."，即使后端已正常返回空订单列表也不会切换到"暂无订单记录"提示。

**根因**：`components/car-mod-studio.tsx` 中 `loadOrders` 的 `useEffect` 使用 `orders.length` 作为防重复加载条件。当 API 返回空数组时，`orders.length` 始终为 0（falsy），每次 `loadOrders` 完成后 `ordersLoading` 从 `true` 变回 `false`，依赖项变化会再次触发 `useEffect`，形成无限循环。`ordersLoading` 在循环中几乎一直为 `true`，导致渲染分支永远停留在"正在加载"状态。

**解决方案**：
1. 新增 `ordersLoaded` 状态标志，在 `loadOrders` 的 `finally` 块中设置为 `true`。
2. 将 `useEffect` 的防重复条件从 `orders.length || ordersLoading` 改为 `ordersLoaded || ordersLoading`，确保无论订单是否为空都只加载一次。

**关联方案ID**：无

---

> 最后更新时间：2026-07-29

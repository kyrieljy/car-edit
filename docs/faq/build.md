# 构建与开发 常见问题

## Q：npm run dev 启动报错 "Cannot find module"
**现象**：执行 `npm run dev` 后终端输出 `Error: Cannot find module`，服务无法启动。

**根因**：项目依赖未安装或 `node_modules` 目录不完整。

**解决方案**：
1. 删除现有依赖目录：`rm -rf node_modules`
2. 清除 npm 缓存：`npm cache clean --force`
3. 重新安装依赖：`npm install`
4. 重新启动开发服务器：`npm run dev`

---

## Q：SQLite 数据库文件不存在导致启动失败
**现象**：首次启动时，API 请求返回 500 错误，日志中提示数据库文件未找到。

**根因**：`data/car_mod_effect.sqlite` 数据库文件在首次运行时由 `lib/server/db.ts` 自动创建并初始化种子数据。如果 `data/` 目录不存在，创建会失败。

**解决方案**：
1. 确认项目根目录下存在 `data/` 目录。
2. 如不存在，手动创建：`mkdir data`
3. 重新启动服务，数据库将自动初始化。

---

## Q：prompt:validate 脚本报错提示 JSON 格式无效
**现象**：运行 `npm run prompt:validate` 时，脚本终止并输出 JSON 解析错误。

**根因**：`config/prompt-packs/` 下的 JSON 文件格式被意外修改（如添加了注释、尾逗号）。

**解决方案**：
1. 打开报错中指向的 JSON 文件。
2. 移除所有注释（JSON 不支持注释）和尾逗号。
3. 使用 JSON 校验工具确认格式正确。
4. 重新运行 `npm run prompt:validate`。

---

> 最后更新时间：2026-07-25

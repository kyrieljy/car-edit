# gpt-image-2 的 `image` 字段传入分析（基于 doc.302.ai/288853817e0）

> 聚焦：配置模式用户点击「生成图片」后，最终发给 302.AI `/v1/images/edits` 的 `image` 字段格式。
> 审计日期：2026-08-07

---

## 1. 接口文档要求的 `image` 输入格式

来源：`/v1/images/edits` 的 `requestBody` 定义（gpt-image-2 属 GPT-Image 系列）。

| 项 | 文档要求 |
|----|----------|
| 字段名 | `image`（multipart 表单字段，**非** `image[]`） |
| 是否必填 | **必填**（与 `prompt`、`model` 并列） |
| 数据类型 | `string`，`format: binary`（即二进制文件，放在 multipart 的 `image` part） |
| 支持格式 | **PNG / WEBP / JPG**（GPT-Image 系列）；注：DALL-E 2 才仅限 PNG 方形 |
| 单张大小 | **≤ 50 MB**（GPT-Image 系列） |
| 数量 | **最多 16 张**（GPT-Image 系列），多张上传时 `mask` 仅作用于第一张 |
| 像素尺寸 | 文档**未规定**明确像素上限 |
| 关联 `mask` | 可选；仅 PNG（含 alpha 通道），≤4MB，必须与第一张原图尺寸完全一致，透明区域（alpha=0）为编辑区 |

> 结论：对 gpt-image-2，文档要求「一个必填的二进制图片文件，格式 PNG/WEBP/JPG，单张 ≤50MB，可多张（≤16），multipart 字段名为 `image`」。

---

## 2. 当前项目配置模式最终传入接口的 `image` 格式

### 2.1 数据流全链路（从「点击生成」到 `formData.append("image", ...)`）

```
car-mod-studio.tsx (配置模式)
  └─ vehicleFile = 用户选择的原始 <input type=file> 文件
  └─ formData.append("vehicleImage", vehicleFile)  →  POST /api/generations

app/api/generations/route.ts  handleGenerationPost()
  ├─ validateImageUpload(file)                 // 仅允许 image/jpeg|png|webp，≤20MB
  ├─ saveUpload(file)
  │     ext  = png→.png / webp→.webp / 否则→.jpg
  │     fileName = vehicle-<ts>-<rand><ext>
  │     writeVehicleUploadImage(fileName, Buffer.from(await file.arrayBuffer()))  // 原样字节写入，无重编码
  │     url = /uploads/<fileName>
  └─ sourceImageUrl = url  →  runGenerationWorkflow({ sourceImageUrl: url, ... })

lib/server/generation-engine.ts  runGenerationWorkflow()
  └─ invokeGenerationWithCallPolicy({ vehicleImageUrl: input.sourceImageUrl, ... })

lib/server/generation-provider.ts  invokeOpenAiCompatibleImageEdit()
  ├─ images = await readImageSource(input.vehicleImageUrl)   // 读取原图
  ├─ formData.append("model", "gpt-image-2")
  ├─ formData.append("prompt", ...)
  ├─ for each image: formData.append("image", new Blob([image.bytes], { type: image.mime }), image.fileName)
  └─ fetch(302Endpoint, { method:"POST", body: formData })
```

### 2.2 `image` 字段最终形态（关键实现）

`readImageSource(url)`（`generation-provider.ts:1753`）对 `/uploads/...` URL 走 `readImageAsset` → `readLocalImageByAppUrl` → `readFirstImageCandidate`：

```ts
const bytes = await readFile(candidate)            // 读取磁盘上的原始字节
const detectedMime = mimeFromImageBytes(bytes)     // 按二进制魔数嗅探：PNG/JPEG/WEBP
return { bytes, mime: detectedMime || mimeFromPath(candidate), fileName }
```

最终发送：

```ts
formData.append("image", new Blob([image.bytes], { type: image.mime }), image.fileName)
```

### 2.3 最终传入接口的 `image` 格式结论

| 维度 | 实际传入值 |
|------|-----------|
| 字段名 | `image`（与文档一致，非 `image[]`） |
| 内容 | **用户上传的原始图片字节，全程无任何重编码/格式转换**（保存用 `Buffer.from(file.arrayBuffer())`，发送用 `new Blob([image.bytes])`） |
| MIME（`type`） | 由字节魔数嗅探得出，必为 `image/png` / `image/jpeg` / `image/webp` 之一 |
| 文件名（`fileName`） | `vehicle-<时间戳>-<随机>.png/.webp/.jpg` |
| 数量 | 配置模式下至少 1 张（车辆原图）；若同时传了配件参考图，会作为额外 `image` part 追加（文档允许 ≤16 张） |
| 大小 | 受项目上传上限 **20MB** 约束（文档允许 50MB，项目更严格） |
| 是否带 `mask` | 否（mask 可选，当前未传；符合 gpt-image-2 单张原图编辑场景） |

---

## 3. 与文档的符合性判定

✅ **格式符合**：传入 MIME 恒为 PNG/WEBP/JPG，落在文档允许集合内；字段名 `image` 正确；为二进制文件。
✅ **大小符合**：项目 20MB 上限 ≤ 文档 50MB 上限。
✅ **数量符合**：配置模式单张（或少量配件参考图），远小于 16 张上限。
✅ **无多余格式变换**：项目对图片只「原样存取 + 魔数嗅探 MIME」，未做尺寸缩放或格式转码，因此不会因为转码引入文档不允许的格式。
⚠️ **潜在盲区（非违规）**：文档未规定 `image` 的像素尺寸上限，项目也未对上传图片做尺寸校验，直接透传。若用户上传超大分辨率图片，可能触及 302 侧隐含限制（文档未明示），但项目当前无该校验——属需注意的边界情况，不改变格式合规性。
⚠️ **注意**：以上「最终传入」格式合规的前提是走 `provider_80fce082`（gpt-image-2 @ api.302ai.cn/v1/images/edits）；该 Provider 当前 `enabled/active/hasApiKey` 均为 false（禁用），但代码路径与 image 构造逻辑已就绪且符合文档。

---

## 4. 一句话总结

文档要求 gpt-image-2 的 `image` 为「PNG/WEBP/JPG 二进制文件、≤50MB、必填、字段名 `image`」；本项目配置模式最终传入的正是 **用户原图的原始字节**（MIME 经魔数嗅探确认为 png/jpeg/webp，文件名 `vehicle-*.{png|webp|jpg}`，大小 ≤20MB），**格式、字段名、大小、数量均符合文档要求，且全程未做格式转换**。

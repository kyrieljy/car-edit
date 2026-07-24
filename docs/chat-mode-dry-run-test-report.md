# Chat Mode Dry Run Test Report

- 测试时间: 2026-07-24T08:40:13.869Z
- 测试方式: 本地启动 Next dev server，登录 demo 用户，POST `/api/chat/messages`。
- 保护开关: `dryRun=1`, `DISABLE_EXTERNAL_AI=1`, `CHAT_DRY_RUN_DEFAULT=1`。
- 范围: A 上传限制、B 基础生成、E 未上传/资产命中/配件分组、F 多轮追问、G 上下文画布、H 宽松 Guardrail。
- 汇总: 88/88 正常，0 异常。

## 测试明细

| ID | 分组 | 用例 | 期望输出 | 实际输出摘要 | 是否正常 | 检查项 | 后续修改方向 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | A 上传限制 | 第一轮不传车辆图 | 200；追问上传原车图，不进入 dry run 生图。 | assistant=请先上传一张原车照片。后续同一对话可以切换 latest/original 继续使用历史画布。<br>parts=0 | 正常 | PASS: status=200<br>PASS: 请先上传一张原车照片。后续同一对话可以切换 latest/original 继续使用历史画布。 |  |
| A2 | A 上传限制 | 上传 2 张车辆图 | 400；提示只允许 1 张车辆图。 | error=对话模式只支持 1 张车辆图。<br>parts=0 | 正常 | PASS: status=400<br>PASS: 对话模式只支持 1 张车辆图。 |  |
| A3 | A 上传限制 | 上传 9 张配件图 | 400；提示最多 8 张配件参考图。 | error=对话模式最多支持 8 张配件参考图。<br>parts=0 | 正常 | PASS: status=400<br>PASS: 对话模式最多支持 8 张配件参考图。 |  |
| A4 | A 上传限制 | 上传非图片文件 | 400；提示仅支持 jpg/png/webp。 | error=仅支持 jpg、png、webp 图片。<br>parts=0 | 正常 | PASS: status=400<br>PASS: 仅支持 jpg、png、webp 图片。 |  |
| A5 | A upload validation | empty text allowed with vehicle and part images | 200 dry run ready; empty prompt is allowed only when vehicle and part images are both uploaded | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882369938-4c6ad4f0ad883.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / 侧裙 uploaded_reference<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=side-skirts/uploaded_reference/side-skirt-primary.jpg/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: parts=1<br>PASS: {"category":"side-skirts","source":"uploaded_reference","assetId":"","brand":"","model":"","variant":"side-skirt-primary.jpg","color":"","colorPolicy":"part_reference_color","options":{},"referenceImageUrl":"/uploads/chat/part-1784882369951-d81cd64c90b78.jpg","referenceImages":[{"role":"full_part_reference","url":"/uploads/chat/part-1784882369951-d81cd64c90b78.jpg","uploadToModel":true}]} |  |
| A6 | A upload validation | empty text rejected without part images | 400 missing text when the request does not include both vehicle and part images | error=请描述你想要的车辆改装效果。<br>parts=0 | 正常 | PASS: status=400<br>PASS: 请描述你想要的车辆改装效果。 |  |
| B1 | B 基础生成 | 原车图 + 改成纳多灰 | dry run ready；parts=[]；paint.action=change；stance=0；prompt 不包含车身姿态段。 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882370704-e25e1c7d0037a.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 纳多灰 / 车身高度不变 / no part<br>paint=change:纳多灰<br>stance=0<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: {"action":"change","target":"纳多灰"}<br>PASS: {"value":0,"label":"车身高度不变"}<br>PASS: prompt should not include stance section when user did not ask for height changes<br>PASS: parts=0 |  |
| B2 | B 基础生成 | 原车图 + 降低一点 | dry run ready；parts=[]；paint.keep_original；stance=70（竞技 0 指）。 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882371240-44e115e306b248.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 竞技 0 指 / no part<br>paint=keep_original:原车漆面<br>stance=70<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: {"action":"keep_original","target":"原车漆面"}<br>PASS: {"value":70,"label":"竞技 0 指"}<br>PASS: parts=0 |  |
| B3 | B 基础生成 | 原车图 + 改白色并降低 | dry run ready；paint.change；stance=70（竞技 0 指）；parts=[]。 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882371720-cab75441a1d78.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 白色 / 竞技 0 指 / no part<br>paint=change:白色<br>stance=70<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: {"action":"change","target":"白色"}<br>PASS: {"value":70,"label":"竞技 0 指"}<br>PASS: parts=0 |  |
| B4 | B 基础生成 | 保持原车颜色，只降低一点 | dry run ready；paint.keep_original；stance=70（竞技 0 指）；parts=[]。 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882372238-d82d1b9449e738.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 竞技 0 指 / no part<br>paint=keep_original:原车漆面<br>stance=70<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: {"action":"keep_original","target":"原车漆面"}<br>PASS: {"value":70,"label":"竞技 0 指"}<br>PASS: parts=0 |  |
| E1 | E 未上传配件追问 | 只说换轮毂 | needs_followup；missingFields 包含 part_reference:wheels；提示补充轮毂具体品牌/型号并上传轮毂参考图。 | assistant=请您补充轮毂的具体品牌/型号，并上传轮毂的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:wheels<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:wheels"]<br>PASS: 请您补充轮毂的具体品牌/型号，并上传轮毂的配件参考图。 |  |
| E1b | E 近似词配件追问 | 只说加个车前盖 | needs_followup；车前盖应归类为 hood；提示补充机盖具体品牌/型号并上传机盖参考图。 | assistant=请您补充机盖的具体品牌/型号，并上传机盖的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:hood<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:hood"]<br>PASS: 请您补充机盖的具体品牌/型号，并上传机盖的配件参考图。 |  |
| E1c-wheels | E 近似词配件追问 | 只说加个轮圈 | needs_followup；轮圈 应归类为 wheels；提示补充轮毂具体品牌/型号并上传参考图。 | assistant=请您补充轮毂的具体品牌/型号，并上传轮毂的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:wheels<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:wheels"]<br>PASS: 请您补充轮毂的具体品牌/型号，并上传轮毂的配件参考图。 |  |
| E1c-calipers | E 近似词配件追问 | 只说加个刹车套件 | needs_followup；刹车套件 应归类为 calipers；提示补充卡钳具体品牌/型号并上传参考图。 | assistant=请您补充卡钳的具体品牌/型号，并上传卡钳的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:calipers<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:calipers"]<br>PASS: 请您补充卡钳的具体品牌/型号，并上传卡钳的配件参考图。 |  |
| E1c-rear-wing | E 近似词配件追问 | 只说加个鸭尾 | ready；鸭尾 命中新版固定样式资产 wing-ducktail。 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882375244-f994a52b2fbec8.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Style Library Ducktail 鸭尾 (表面颜色/材质：黑色)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=rear-wing/asset_library/Ducktail/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"rear-wing","source":"asset_library","assetId":"wing-ducktail","brand":"Style Library","model":"Ducktail","variant":"鸭尾","color":"configurable","colorPolicy":"part_reference_color","optionSummary":"表面颜色/材质：黑色","options":{"surfaceColor":"black","surfaceColorLabel":"黑色"},"referenceImageUrl":"/assets/parts/test-cases/f82-m4-kies-carbon-trunk-lip-spoiler.jpg","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/f82-m4-kies-carbon-trunk-lip-spoiler.jpg","uploadToModel":true}]}] |  |
| E1c-front-bumper | E 近似词配件追问 | 只说加个前铲 | ready；前铲 命中新版固定样式资产 front-splitter-style。 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882375657-e2e83f64f8fb9.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Style Library Front splitter 前铲 (表面颜色/材质：黑色)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=front-bumper/asset_library/Front splitter/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"front-bumper","source":"asset_library","assetId":"front-splitter-style","brand":"Style Library","model":"Front splitter","variant":"前铲","color":"configurable","colorPolicy":"part_reference_color","optionSummary":"表面颜色/材质：黑色","options":{"surfaceColor":"black","surfaceColorLabel":"黑色"},"referenceImageUrl":"/assets/parts/test-cases/apr-f80-front-splitter.webp","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/apr-f80-front-splitter.webp","uploadToModel":true}]}] |  |
| E1c-side-skirts | E 近似词配件追问 | 只说加个门槛条 | needs_followup；门槛条 应归类为 side-skirts；提示补充侧裙具体品牌/型号并上传参考图。 | assistant=请您补充侧裙的具体品牌/型号，并上传侧裙的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:side-skirts<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:side-skirts"]<br>PASS: 请您补充侧裙的具体品牌/型号，并上传侧裙的配件参考图。 |  |
| E1c-exhaust | E 近似词配件追问 | 只说加个尾嘴 | needs_followup；尾嘴 应归类为 exhaust；提示补充排气具体品牌/型号并上传参考图。 | assistant=请您补充排气的具体品牌/型号，并上传排气的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:exhaust<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:exhaust"]<br>PASS: 请您补充排气的具体品牌/型号，并上传排气的配件参考图。 |  |
| E1c-mirrors | E 近似词配件追问 | 只说加个反光镜 | needs_followup；反光镜 应归类为 mirrors；提示补充后视镜具体品牌/型号并上传参考图。 | assistant=请您补充后视镜的具体品牌/型号，并上传后视镜的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:mirrors<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:mirrors"]<br>PASS: 请您补充后视镜的具体品牌/型号，并上传后视镜的配件参考图。 |  |
| E1c-fenders | E 近似词配件追问 | 只说加个叶子板 | needs_followup；叶子板 应归类为 fenders；提示补充叶子板具体品牌/型号并上传参考图。 | assistant=请您补充叶子板的具体品牌/型号，并上传叶子板的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:fenders<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:fenders"]<br>PASS: 请您补充叶子板的具体品牌/型号，并上传叶子板的配件参考图。 |  |
| E1c-trunk-lid | E 近似词配件追问 | 只说加个后备箱盖 | needs_followup；后备箱盖 应归类为 trunk-lid；提示补充后备箱盖具体品牌/型号并上传参考图。 | assistant=请您补充后备箱盖的具体品牌/型号，并上传后备箱盖的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:trunk-lid<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:trunk-lid"]<br>PASS: 请您补充后备箱盖的具体品牌/型号，并上传后备箱盖的配件参考图。 |  |
| E2 | E 未上传配件追问 | 未收录具体型号 ABC999 轮毂 | needs_followup；提示系统暂未收录该配件 ABC999，并要求上传 ABC999 参考图。 | assistant=系统暂未收录该配件轮毂 ABC999，请您上传轮毂 ABC999的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:wheels<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: 系统暂未收录该配件轮毂 ABC999，请您上传轮毂 ABC999的配件参考图。 |  |
| E3 | E 新版固定样式资产 | 具体型号 RSCBMW001 侧裙 | ready；旧 RSC 型号不再前台展示，侧裙命中新版固定样式资产。 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882378849-fe505f060dd9d.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Style Library Side skirts 侧裙 (表面颜色/材质：黑色)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=side-skirts/asset_library/Side skirts/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"side-skirts","source":"asset_library","assetId":"side-skirts-style","brand":"Style Library","model":"Side skirts","variant":"侧裙","color":"configurable","colorPolicy":"part_reference_color","optionSummary":"表面颜色/材质：黑色","options":{"surfaceColor":"black","surfaceColorLabel":"黑色"},"referenceImageUrl":"/assets/parts/test-cases/rsc-f80-side-skirts.webp","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/rsc-f80-side-skirts.webp","uploadToModel":true}]}] |  |
| E3a | E 新版干碳开关 | 具体关键字 HD14BMWF80-OE 机盖 | needs_followup；旧 Seibon SKU 不再作为前台机盖资产，未说明裸碳时追问机盖参考/意图。 | assistant=系统暂未收录该配件机盖 HD14BMWF80-OE，请您上传机盖 HD14BMWF80-OE的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:hood<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:hood"]<br>PASS: [] |  |
| E4 | E 上传部分配件但文字追加未上传配件 | 上传机盖图，同时要求轮毂 | 不生图；needs_followup；要求补充轮毂具体品牌/型号并上传轮毂参考图，动态文案只应指向轮毂。 | assistant=请您补充轮毂的具体品牌/型号，并上传轮毂的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:wheels<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:wheels"]<br>PASS: 请您补充轮毂的具体品牌/型号，并上传轮毂的配件参考图。 |  |
| E5 | E 上传配件分组 | 上传 2 张侧裙图 | ready；parts.length=1；category=side-skirts；referenceImages=2。 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882380442-26d19a89bf0a7.jpg / 配件参考图：2 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / 侧裙 uploaded_reference<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=side-skirts/uploaded_reference/side-skirt-primary.jpg/refs:2<br>providerRefs=2 | 正常 | PASS: status=200<br>PASS: parts=1<br>PASS: {"category":"side-skirts","source":"uploaded_reference","assetId":"","brand":"","model":"","variant":"side-skirt-primary.jpg","color":"","colorPolicy":"part_reference_color","options":{},"referenceImageUrl":"/uploads/chat/part-1784882380453-ab67ba5b95ee4.jpg","referenceImages":[{"role":"full_part_reference","url":"/uploads/chat/part-1784882380453-ab67ba5b95ee4.jpg","uploadToModel":true},{"role":"shape_reference","url":"/uploads/chat/part-1784882380453-4c9b6b825a1b4.jpg","uploadToModel":true}]}<br>PASS: refs=2<br>PASS: previewRefs=2 |  |
| H1 | H 宽松 Guardrail | 原车图 + 做成这样，无配件图 | Chat guardrail 放行；parser 返回 needs_followup，不再 400。 | assistant=请先补充一个更明确的信息，再继续生成。<br>parseStatus=needs_followup<br>missingFields=part_category<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_category"] |  |
| H2 | H 宽松 Guardrail | 原车图 + 侧裙图 + 做成这样 | 有配件图时短文本放行并生成 side-skirts part group。 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882381393-a6cd65deef3a58.jpg / 配件参考图：2 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / 侧裙 uploaded_reference<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=side-skirts/uploaded_reference/side-skirt-primary.jpg/refs:2<br>providerRefs=2 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: parts=1<br>PASS: {"category":"side-skirts","source":"uploaded_reference","assetId":"","brand":"","model":"","variant":"side-skirt-primary.jpg","color":"","colorPolicy":"part_reference_color","options":{},"referenceImageUrl":"/uploads/chat/part-1784882381400-f91a701e0e06a.jpg","referenceImages":[{"role":"full_part_reference","url":"/uploads/chat/part-1784882381400-f91a701e0e06a.jpg","uploadToModel":true},{"role":"shape_reference","url":"/uploads/chat/part-1784882381400-cc866f26a2aa6.jpg","uploadToModel":true}]}<br>PASS: refs=2 |  |
| H3 | H 宽松 Guardrail | 原车图 + 侧裙图 + 照着图片装 | 常见口语短句放行，依靠配件识别生成 side-skirts。 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882381913-d9316160a2abf8.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / 侧裙 uploaded_reference<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=side-skirts/uploaded_reference/side-skirt-primary.jpg/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: parts=1<br>PASS: {"category":"side-skirts","source":"uploaded_reference","assetId":"","brand":"","model":"","variant":"side-skirt-primary.jpg","color":"","colorPolicy":"part_reference_color","options":{},"referenceImageUrl":"/uploads/chat/part-1784882381929-592f244bf028a8.jpg","referenceImages":[{"role":"full_part_reference","url":"/uploads/chat/part-1784882381929-592f244bf028a8.jpg","uploadToModel":true}]} |  |
| H4 | H 宽松 Guardrail | 原车图 + 可以 | 上下文短回复放行到 parser，由 parser 追问；不再 400。 | assistant=请先补充一个更明确的信息，再继续生成。<br>parseStatus=needs_followup<br>missingFields=part_category<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup |  |
| H5 | H 宽松 Guardrail | blocked term 仍然拦截 | blocked terms 仍然 400，不因宽松 guardrail 放行。 | error=Request is outside car modification scope: weapon.<br>parts=0 | 正常 | PASS: status=400<br>PASS: Request is outside car modification scope: weapon. |  |
| G4 | G 上下文画布 | 新会话不传车图 | 200；追问上传原车图。 | assistant=请先上传一张原车照片。后续同一对话可以切换 latest/original 继续使用历史画布。<br>parts=0 | 正常 | PASS: status=200<br>PASS: 请先上传一张原车照片。后续同一对话可以切换 latest/original 继续使用历史画布。 |  |
| E3b | E catalog ambiguity | brand-only Seibon hood should not auto-pick first asset | needs_followup; brand-only catalog text is not an exact asset match | assistant=The system has not collected Hood seibon hood Hood yet. Please upload reference image(s) for Hood seibon hood Hood.<br>parseStatus=needs_followup<br>missingFields=part_reference:hood<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:hood"]<br>PASS: [] |  |
| B5 | B color parser | vehicle + change to military green | dry run ready; paint.action=change; target=military green | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882383963-c5e8d659d881b.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 军绿色 / 车身高度不变 / no part<br>paint=change:军绿色<br>stance=0<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: {"action":"change","target":"军绿色"}<br>PASS: {"action":"change","target":"军绿色"}<br>PASS: parts=0 |  |
| B6 | B color parser | vehicle + darker military green not too bright | dry run ready; paint.action=change; target=military green; prompt carries darker preference | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882384471-9261a475f9b78.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 军绿色 / 车身高度不变 / no part<br>paint=change:军绿色<br>stance=0<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: {"action":"change","target":"军绿色"}<br>PASS: {"action":"change","target":"军绿色"}<br>PASS: # Effective Prompt v1 中文有效版

请对第一张上传的原车照片做真实照片局部编辑。第一张上传图片是唯一原车画布；后续上传图片全部是配件参考图，只能参考已选配件的形状、材质和安装关系，绝对不要继承参考图里的其它车辆、背景、光线、相机角度、轮毂、贴纸或未选择部件。

## 模板层
### 通用基础 Prompt - 唯一画布与参考图角色
任务类型：真实照片局部编辑。第一张原车照片是唯一画布，所有输出必须看起来像在这张原图上做局部修图。必须保留原图背景、地面、墙面、车位线、其它车辆、光线方向、反射、阴影、相机角度、裁切范围、车辆位置、车身比例、车牌位置和形状、玻璃、灯组、轮毂、轮胎、黑色塑料饰条、碳纤维件、进气格栅、尾翼和未选择部件。后续图片全部是配件参考图，不是画布，不是车身参考，不是场景参考。

### 对话模式 Prompt - 用户请求转局部编辑
本次生图来自用户自然语言需求。请只执行用户明确要求的改装项，保持请求范围尽量小。若用户上传配件参考图，第一张仍是唯一原车画布，后续图片只用于对应配件的造型、材质、比例和安装意图。若用户提到机盖裸碳、露碳、碳纤维机盖、exposed carbon 或 carbon hood，机盖 colorPolicy 为 exposed_carbon；否则机盖默认 body_color。

## 原车画布
{
  "model": "User uploaded vehicle, preserve exact identity",
  "view": "front three-quarter",
  "sourceImageUrl": "/uploads/chat/vehicle-1784882384471-9261a475f9b78.jpg",
  "confidence": 0.88
}

## 车身颜色
- 动作: change
- 目标: 军绿色
- 指令: Change only the vehicle body paint to 军绿色.  Finish preference: darker, deeper, lower-brightness. Preserve the source vehicle identity, body shape, panel gaps, headlights, glass, wheels, tires, license plate shape, black plastic trim, carbon fiber parts, grille, rear wing or spoiler, camera angle, lighting, and background. Do not tint glass, lights, wheels, tires, license plate, black plastic trim, carbon fiber parts, grille, rear wing or spoiler, ground, nearby cars, or the background with the requested body color.

## 已选配件
- 没有选择配件替换。只执行已请求的车身颜色或车高姿态变化，不要凭空新增外观配件。

## 用户请求
改成更深的军绿色，不要那么亮

## 保留规则
- 必须保留第一张原图中的同一辆车、同一车型、同一车身比例、同一相机角度、同一裁切、同一光照方向、同一反射、同一背景和车牌区域形状。
- 只修改标准 JSON 中已选择的类别。所有未选择配件、轮毂、贴纸、车窗、车门、后视镜、饰条和未选择钣金区域都保持原图。
- 配件比例、透视、遮挡、接触阴影和反光必须符合第一张原车视角。
- 如果某个配件在第一张原车视角中不可见，不要为了展示它而改变相机角度、扩展画面或重画车身另一侧。

## 负向约束
不要重新生成整车，不要换背景，不要换场景，不要换停车场，不要换道路，不要换墙面，不要换光线，不要换相机角度，不要换裁切，不要换车辆位置，不要换车型，不要改变车身比例，不要改变车顶线，不要改变窗线，不要改变轮拱形状，不要改变未选择轮毂，不要把轮毂改成 BBS，不要改变轮胎，不要添加未选择配件，不要添加大尾翼，不要改变未选择尾翼，不要添加排气，不要改变尾灯，不要改变后视镜，不要复制参考图背景，不要复制参考图里的其它车辆，不要复制参考图文字，不要水印，不要人物，不要展厅广告图，不要户外新场景，不要黑色机盖，除非明确要求裸露碳纤维机盖，不要让车身颜色污染玻璃、灯组、轮毂、轮胎、车牌、黑色塑料饰条、碳纤维件、进气格栅、尾翼、背景或地面。 |  |
| B7 | B color parser | vehicle + typo change to egg yellow | dry run ready; common typo resolves to yellow body paint | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882384913-d995e33a5c7ae8.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 黄色 / 车身高度不变 / no part<br>paint=change:黄色<br>stance=0<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: {"action":"change","target":"黄色"}<br>PASS: {"action":"change","target":"黄色"} |  |
| B8 | B color parser | vague color correction asks for target color | needs_followup; after fallback cannot confirm, asks for one clearer modification detail | assistant=请先补充一个更明确的信息，再继续生成。<br>parseStatus=needs_followup<br>missingFields=paint_color<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["paint_color"]<br>PASS: 请先补充一个更明确的信息，再继续生成。 |  |
| B9 | B color parser | freeform English color phrase | dry run ready; paint target keeps freeform natural-language color | assistant=Dry run completed. No external AI call was made. / Source canvas: /uploads/chat/vehicle-1784882386099-da3e486b1a98b.jpg / Part references: 0 / Summary: chat / User uploaded vehicle, preserve exact identity / midnight teal / 车身高度不变 / no part<br>paint=change:midnight teal<br>stance=0<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: {"action":"change","target":"midnight teal"}<br>PASS: {"action":"change","target":"midnight teal"} |  |
| B10 | B color parser | natural-language brake caliper repaint | dry run ready; caliper color repaint does not ask for part reference | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882386641-63ff84ef2f45f.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / 卡钳 free_text<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=calipers/free_text/caliper color repaint/refs:0 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: {"action":"keep_original","target":"原车漆面"}<br>PASS: [{"category":"calipers","source":"free_text","assetId":"","brand":"","model":"","variant":"caliper color repaint","color":"橙色","colorPolicy":"part_reference_color","options":{},"referenceImageUrl":"","referenceImages":[]}]<br>PASS: []<br>PASS: # Effective Prompt v1 中文有效版

请对第一张上传的原车照片做真实照片局部编辑。第一张上传图片是唯一原车画布；后续上传图片全部是配件参考图，只能参考已选配件的形状、材质和安装关系，绝对不要继承参考图里的其它车辆、背景、光线、相机角度、轮毂、贴纸或未选择部件。

## 模板层
### 通用基础 Prompt - 唯一画布与参考图角色
任务类型：真实照片局部编辑。第一张原车照片是唯一画布，所有输出必须看起来像在这张原图上做局部修图。必须保留原图背景、地面、墙面、车位线、其它车辆、光线方向、反射、阴影、相机角度、裁切范围、车辆位置、车身比例、车牌位置和形状、玻璃、灯组、轮毂、轮胎、黑色塑料饰条、碳纤维件、进气格栅、尾翼和未选择部件。后续图片全部是配件参考图，不是画布，不是车身参考，不是场景参考。

### 对话模式 Prompt - 用户请求转局部编辑
本次生图来自用户自然语言需求。请只执行用户明确要求的改装项，保持请求范围尽量小。若用户上传配件参考图，第一张仍是唯一原车画布，后续图片只用于对应配件的造型、材质、比例和安装意图。若用户提到机盖裸碳、露碳、碳纤维机盖、exposed carbon 或 carbon hood，机盖 colorPolicy 为 exposed_carbon；否则机盖默认 body_color。

## 原车画布
{
  "model": "User uploaded vehicle, preserve exact identity",
  "view": "front three-quarter",
  "sourceImageUrl": "/uploads/chat/vehicle-1784882386641-63ff84ef2f45f.jpg",
  "confidence": 0.88
}

## 车身颜色
- 动作: keep_original
- 目标: 原车漆面
- 指令: 保持原车车身漆面颜色、色相、光泽、反射和钓金面连续性。

## 已选配件
### 1. 卡钳 (calipers)
- 来源: free_text
- 参考图:
- 目录颜色: 橙色
- colorPolicy: part_reference_color
- colorPolicyPrompt: Repaint only the visible brake calipers to 橙色. Preserve brake discs, wheels, tires, wheel spokes, body paint, glass, lights, background, camera angle, and lighting.
- 指令: Local edit: change only the visible brake caliper color to 橙色. Keep the calipers behind the wheel spokes and attached to the brake discs with realistic occlusion, scale, shadow, and reflections. Do not add a new brake kit, change wheel design, recolor wheels, or alter the vehicle body paint.
- 分类模板:
刹车卡钳必须位于轮辐后方并贴合刹车盘，不能漂浮在轮毂表面，也不能盖住轮毂主体造型。只允许修改轮辐后方可见的卡钳颜色和标准 JSON 指定的刹车盘类型，不要改变轮毂款式、轮胎、车身、车高或背景。加大刹车盘要体现更大的盘面直径和合理间隙；碳陶瓷刹车盘要体现更浅的陶瓷盘面和真实金属/陶瓷层次。

## 用户请求
能不能把这个卡钳改成橙色啊

## 保留规则
- 必须保留第一张原图中的同一辆车、同一车型、同一车身比例、同一相机角度、同一裁切、同一光照方向、同一反射、同一背景和车牌区域形状。
- 只修改标准 JSON 中已选择的类别。所有未选择配件、轮毂、贴纸、车窗、车门、后视镜、饰条和未选择钣金区域都保持原图。
- 配件比例、透视、遮挡、接触阴影和反光必须符合第一张原车视角。
- 如果某个配件在第一张原车视角中不可见，不要为了展示它而改变相机角度、扩展画面或重画车身另一侧。

## 负向约束
不要重新生成整车，不要换背景，不要换场景，不要换停车场，不要换道路，不要换墙面，不要换光线，不要换相机角度，不要换裁切，不要换车辆位置，不要换车型，不要改变车身比例，不要改变车顶线，不要改变窗线，不要改变轮拱形状，不要改变未选择轮毂，不要把轮毂改成 BBS，不要改变轮胎，不要添加未选择配件，不要添加大尾翼，不要改变未选择尾翼，不要添加排气，不要改变尾灯，不要改变后视镜，不要复制参考图背景，不要复制参考图里的其它车辆，不要复制参考图文字，不要水印，不要人物，不要展厅广告图，不要户外新场景，不要黑色机盖，除非明确要求裸露碳纤维机盖，不要让车身颜色污染玻璃、灯组、轮毂、轮胎、车牌、黑色塑料饰条、碳纤维件、进气格栅、尾翼、背景或地面。 |  |
| B11 | B color parser | brake caliper repaint without target asks color only | needs_followup; asks for target caliper color instead of brand/model/reference | assistant=请说明要把刹车卡钳改成什么颜色，例如红色、橙色、黄色或金属绿。<br>parseStatus=needs_followup<br>missingFields=paint_color<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["paint_color"]<br>PASS: ["paint_color"]<br>PASS: 请说明要把刹车卡钳改成什么颜色，例如红色、橙色、黄色或金属绿。 |  |
| B12 | B color parser | typo Brembo caliper plus white body asks for caliper reference | needs_followup; typo brand caliper is a part request, while white remains a body paint intent | assistant=系统暂未收录该配件卡钳 bembo，请您上传卡钳 bembo的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:calipers<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:calipers"]<br>PASS: ["part_reference:calipers"]<br>PASS: 系统暂未收录该配件卡钳 bembo，请您上传卡钳 bembo的配件参考图。 |  |
| B13 | B color parser | exact Brembo GT caliper plus white body | dry run ready; exact catalog caliper is selected and body paint is white | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882388261-307d3eda9933f8.jpg / 配件参考图：3 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 白色 / 车身高度不变 / Brembo GT Red (卡钳颜色：Racing red；刹车盘：不变)<br>paint=change:白色<br>stance=0<br>context=latest<br>parts=calipers/asset_library/GT/refs:3<br>providerRefs=3 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: {"action":"change","target":"白色"}<br>PASS: [{"category":"calipers","source":"asset_library","assetId":"brembo-gt-red","brand":"Brembo","model":"GT","variant":"Red","color":"Racing red","colorPolicy":"part_reference_color","optionSummary":"卡钳颜色：Racing red；刹车盘：不变","options":{"caliperColor":"Racing red","rotorOption":"stock","rotorLabel":"不变"},"referenceImageUrl":"/assets/parts/references/multi-ref-v1/brembo-gt-red/01-red-drilled.jpg","referenceImages":[{"role":"install_context","url":"/assets/parts/references/multi-ref-v1/brembo-gt-red/01-red-drilled.jpg","uploadToModel":true},{"role":"install_context","url":"/assets/parts/references/multi-ref-v1/brembo-gt-red/02-red-slotted-type-1.jpg","uploadToModel":true},{"role":"install_context","url":"/assets/parts/references/multi-ref-v1/brembo-gt-red/03-red-slotted-type-3.jpg","uploadToModel":true}]}]<br>PASS: # Effective Prompt v1 中文有效版

请对第一张上传的原车照片做真实照片局部编辑。第一张上传图片是唯一原车画布；后续上传图片全部是配件参考图，只能参考已选配件的形状、材质和安装关系，绝对不要继承参考图里的其它车辆、背景、光线、相机角度、轮毂、贴纸或未选择部件。

## 模板层
### 通用基础 Prompt - 唯一画布与参考图角色
任务类型：真实照片局部编辑。第一张原车照片是唯一画布，所有输出必须看起来像在这张原图上做局部修图。必须保留原图背景、地面、墙面、车位线、其它车辆、光线方向、反射、阴影、相机角度、裁切范围、车辆位置、车身比例、车牌位置和形状、玻璃、灯组、轮毂、轮胎、黑色塑料饰条、碳纤维件、进气格栅、尾翼和未选择部件。后续图片全部是配件参考图，不是画布，不是车身参考，不是场景参考。

### 对话模式 Prompt - 用户请求转局部编辑
本次生图来自用户自然语言需求。请只执行用户明确要求的改装项，保持请求范围尽量小。若用户上传配件参考图，第一张仍是唯一原车画布，后续图片只用于对应配件的造型、材质、比例和安装意图。若用户提到机盖裸碳、露碳、碳纤维机盖、exposed carbon 或 carbon hood，机盖 colorPolicy 为 exposed_carbon；否则机盖默认 body_color。

## 原车画布
{
  "model": "User uploaded vehicle, preserve exact identity",
  "view": "front three-quarter",
  "sourceImageUrl": "/uploads/chat/vehicle-1784882388261-307d3eda9933f8.jpg",
  "confidence": 0.88
}

## 车身颜色
- 动作: change
- 目标: 白色
- 指令: Change only the vehicle body paint to 白色. Preserve the source vehicle identity, body shape, panel gaps, headlights, glass, wheels, tires, license plate shape, black plastic trim, carbon fiber parts, grille, rear wing or spoiler, camera angle, lighting, and background. Do not tint glass, lights, wheels, tires, license plate, black plastic trim, carbon fiber parts, grille, rear wing or spoiler, ground, nearby cars, or the background with the requested body color.

## 已选配件
### 1. 卡钳 (calipers)
- 来源: asset_library
- 资产: Brembo GT Red
- 目录颜色: Racing red
- 材质/表面: gloss powder coat
- 选项摘要: 卡钳颜色：Racing red；刹车盘：不变
- options: {"caliperColor":"Racing red","rotorOption":"stock","rotorLabel":"不变"}
- colorPolicy: part_reference_color
- colorPolicyPrompt: 卡钳 只参考已选配件参考图的颜色和材质；不要继承参考图中捐赠车辆的车漆或无关颜色。
- 指令: 只在轮辐后方添加红色 Brembo GT 刹车卡钳。卡钳必须贴合刹车盘并被轮辐自然遮挡，不能覆盖轮毂主体造型。 本次选项：卡钳颜色：Racing red；刹车盘：不变。
- 配件参考图:
1. /assets/parts/references/multi-ref-v1/brembo-gt-red/01-red-drilled.jpg / 角色=install_context / 视角=primary / 上传给模型=true / 提示=Brembo 红色卡钳参考图：只参考安装位置、颜色和刹车盘关系。
2. /assets/parts/references/multi-ref-v1/brembo-gt-red/02-red-slotted-type-1.jpg / 角色=install_context / 视角=reference-2 / 上传给模型=true / 提示=Brembo 红色卡钳参考图：只参考安装位置、颜色和刹车盘关系。
3. /assets/parts/references/multi-ref-v1/brembo-gt-red/03-red-slotted-type-3.jpg / 角色=install_context / 视角=reference-3 / 上传给模型=true / 提示=Brembo 红色卡钳参考图：只参考安装位置、颜色和刹车盘关系。
- 分类模板:
刹车卡钳必须位于轮辐后方并贴合刹车盘，不能漂浮在轮毂表面，也不能盖住轮毂主体造型。只允许修改轮辐后方可见的卡钳颜色和标准 JSON 指定的刹车盘类型，不要改变轮毂款式、轮胎、车身、车高或背景。加大刹车盘要体现更大的盘面直径和合理间隙；碳陶瓷刹车盘要体现更浅的陶瓷盘面和真实金属/陶瓷层次。

## 用户请求
改个Brembo GT卡钳，再改成白色

## 保留规则
- 必须保留第一张原图中的同一辆车、同一车型、同一车身比例、同一相机角度、同一裁切、同一光照方向、同一反射、同一背景和车牌区域形状。
- 只修改标准 JSON 中已选择的类别。所有未选择配件、轮毂、贴纸、车窗、车门、后视镜、饰条和未选择钣金区域都保持原图。
- 配件比例、透视、遮挡、接触阴影和反光必须符合第一张原车视角。
- 如果某个配件在第一张原车视角中不可见，不要为了展示它而改变相机角度、扩展画面或重画车身另一侧。

## 负向约束
不要重新生成整车，不要换背景，不要换场景，不要换停车场，不要换道路，不要换墙面，不要换光线，不要换相机角度，不要换裁切，不要换车辆位置，不要换车型，不要改变车身比例，不要改变车顶线，不要改变窗线，不要改变轮拱形状，不要改变未选择轮毂，不要把轮毂改成 BBS，不要改变轮胎，不要添加未选择配件，不要添加大尾翼，不要改变未选择尾翼，不要添加排气，不要改变尾灯，不要改变后视镜，不要复制参考图背景，不要复制参考图里的其它车辆，不要复制参考图文字，不要水印，不要人物，不要展厅广告图，不要户外新场景，不要黑色机盖，除非明确要求裸露碳纤维机盖，不要让车身颜色污染玻璃、灯组、轮毂、轮胎、车牌、黑色塑料饰条、碳纤维件、进气格栅、尾翼、背景或地面。 |  |
| V2-1 | V2 配件选项 | Brembo GT 蓝色卡钳 + 碳陶盘 | ready; caliper options include blue + carbon_ceramic | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882388760-9715f01e7e15d8.jpg / 配件参考图：3 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 蓝色 / 车身高度不变 / Brembo GT Red (卡钳颜色：blue；刹车盘：碳陶瓷刹车盘)<br>paint=change:蓝色<br>stance=0<br>context=latest<br>parts=calipers/asset_library/GT/refs:3<br>providerRefs=3 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"calipers","source":"asset_library","assetId":"brembo-gt-red","brand":"Brembo","model":"GT","variant":"Red","color":"Racing red","colorPolicy":"part_reference_color","optionSummary":"卡钳颜色：blue；刹车盘：碳陶瓷刹车盘","options":{"caliperColor":"blue","rotorOption":"carbon_ceramic","rotorLabel":"碳陶瓷刹车盘"},"referenceImageUrl":"/assets/parts/references/multi-ref-v1/brembo-gt-red/01-red-drilled.jpg","referenceImages":[{"role":"install_context","url":"/assets/parts/references/multi-ref-v1/brembo-gt-red/01-red-drilled.jpg","uploadToModel":true},{"role":"install_context","url":"/assets/parts/references/multi-ref-v1/brembo-gt-red/02-red-slotted-type-1.jpg","uploadToModel":true},{"role":"install_context","url":"/assets/parts/references/multi-ref-v1/brembo-gt-red/03-red-slotted-type-3.jpg","uploadToModel":true}]}] |  |
| V2-2 | V2 配件选项 | 鸭尾碳纤维 | ready; rear-wing ducktail uses exposed carbon surface option | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882389305-3add6589bb084.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Style Library Ducktail 鸭尾 (表面颜色/材质：碳纤维)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=rear-wing/asset_library/Ducktail/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"rear-wing","source":"asset_library","assetId":"wing-ducktail","brand":"Style Library","model":"Ducktail","variant":"鸭尾","color":"configurable","colorPolicy":"exposed_carbon","optionSummary":"表面颜色/材质：碳纤维","options":{"surfaceColor":"exposed_carbon","surfaceColorLabel":"碳纤维"},"referenceImageUrl":"/assets/parts/test-cases/f82-m4-kies-carbon-trunk-lip-spoiler.jpg","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/f82-m4-kies-carbon-trunk-lip-spoiler.jpg","uploadToModel":true}]}] |  |
| V2-3 | V2 配件选项 | 双边双出排气 | ready; exhaust layout is quad | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882389795-8be437541f6578.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Layout Library Dual side dual 双边双出 (排气布局：双边双出)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=exhaust/asset_library/Dual side dual/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"exhaust","source":"asset_library","assetId":"exhaust-quad","brand":"Layout Library","model":"Dual side dual","variant":"双边双出","color":"metal","colorPolicy":"part_reference_color","optionSummary":"排气布局：双边双出","options":{"layout":"exhaust-quad","layoutLabel":"双边双出"},"referenceImageUrl":"/assets/parts/test-cases/exhaust-layout-quad.svg","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/exhaust-layout-quad.svg","uploadToModel":true}]}] |  |
| V2-3a | V2 配件选项 | 单边单出右侧排气 | ready; exhaust layout is single right | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882390289-5240908029499.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Layout Library Single right 单边单出（右） (排气布局：单边单出（右）)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=exhaust/asset_library/Single right/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"exhaust","source":"asset_library","assetId":"exhaust-single-right","brand":"Layout Library","model":"Single right","variant":"单边单出（右）","color":"metal","colorPolicy":"part_reference_color","optionSummary":"排气布局：单边单出（右）","options":{"layout":"exhaust-single-right","layoutLabel":"单边单出（右）"},"referenceImageUrl":"/assets/parts/test-cases/exhaust-layout-single-right.svg","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/exhaust-layout-single-right.svg","uploadToModel":true}]}] |  |
| V2-3b | V2 配件选项 | 单边双出左侧排气 | ready; exhaust layout is dual left | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882390803-51fccc2875dbe8.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Layout Library Dual left 单边双出（左） (排气布局：单边双出（左）)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=exhaust/asset_library/Dual left/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"exhaust","source":"asset_library","assetId":"exhaust-dual-left","brand":"Layout Library","model":"Dual left","variant":"单边双出（左）","color":"metal","colorPolicy":"part_reference_color","optionSummary":"排气布局：单边双出（左）","options":{"layout":"exhaust-dual-left","layoutLabel":"单边双出（左）"},"referenceImageUrl":"/assets/parts/test-cases/exhaust-layout-dual-left.svg","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/exhaust-layout-dual-left.svg","uploadToModel":true}]}] |  |
| V2-3c | V2 配件选项 | 单边双出右侧排气 | ready; exhaust layout is dual right | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882391278-71f17cb68c5f4.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Layout Library Dual right 单边双出（右） (排气布局：单边双出（右）)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=exhaust/asset_library/Dual right/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"exhaust","source":"asset_library","assetId":"exhaust-dual-right","brand":"Layout Library","model":"Dual right","variant":"单边双出（右）","color":"metal","colorPolicy":"part_reference_color","optionSummary":"排气布局：单边双出（右）","options":{"layout":"exhaust-dual-right","layoutLabel":"单边双出（右）"},"referenceImageUrl":"/assets/parts/test-cases/exhaust-layout-dual-right.svg","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/exhaust-layout-dual-right.svg","uploadToModel":true}]}] |  |
| V2-3d | V2 配件选项 | 双边单出排气 | ready; exhaust layout is dual single | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882391719-e9ca4326e84998.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Layout Library Dual single 双边单出 (排气布局：双边单出)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=exhaust/asset_library/Dual single/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"exhaust","source":"asset_library","assetId":"exhaust-dual-single","brand":"Layout Library","model":"Dual single","variant":"双边单出","color":"metal","colorPolicy":"part_reference_color","optionSummary":"排气布局：双边单出","options":{"layout":"exhaust-dual-single","layoutLabel":"双边单出"},"referenceImageUrl":"/assets/parts/test-cases/exhaust-layout-dual-single.svg","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/exhaust-layout-dual-single.svg","uploadToModel":true}]}] |  |
| V2-3e | V2 配件选项 | 居中 1 根排气 | ready; exhaust layout is center single | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882392162-6533b6db6697.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Layout Library Center single 居中单管 (排气布局：居中 1 根)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=exhaust/asset_library/Center single/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"exhaust","source":"asset_library","assetId":"exhaust-center-single","brand":"Layout Library","model":"Center single","variant":"居中单管","color":"metal","colorPolicy":"part_reference_color","optionSummary":"排气布局：居中 1 根","options":{"layout":"exhaust-center-single","layoutLabel":"居中 1 根"},"referenceImageUrl":"/assets/parts/test-cases/exhaust-layout-center-single.svg","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/exhaust-layout-center-single.svg","uploadToModel":true}]}] |  |
| V2-3f | V2 配件选项 | 居中 2 根排气 | ready; exhaust layout is center dual | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882392628-1978064ed41868.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Layout Library Center dual 居中双管 (排气布局：居中 2 根)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=exhaust/asset_library/Center dual/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"exhaust","source":"asset_library","assetId":"exhaust-center-dual","brand":"Layout Library","model":"Center dual","variant":"居中双管","color":"metal","colorPolicy":"part_reference_color","optionSummary":"排气布局：居中 2 根","options":{"layout":"exhaust-center-dual","layoutLabel":"居中 2 根"},"referenceImageUrl":"/assets/parts/test-cases/exhaust-layout-center-dual.svg","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/exhaust-layout-center-dual.svg","uploadToModel":true}]}] |  |
| V2-3g | V2 配件选项 | 居中 4 根排气 | ready; exhaust layout is center quad | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882393067-805e1e68daa39.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Layout Library Center quad 居中四管 (排气布局：居中 4 根)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=exhaust/asset_library/Center quad/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"exhaust","source":"asset_library","assetId":"exhaust-center-quad","brand":"Layout Library","model":"Center quad","variant":"居中四管","color":"metal","colorPolicy":"part_reference_color","optionSummary":"排气布局：居中 4 根","options":{"layout":"exhaust-center-quad","layoutLabel":"居中 4 根"},"referenceImageUrl":"/assets/parts/test-cases/exhaust-layout-center-quad.svg","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/exhaust-layout-center-quad.svg","uploadToModel":true}]}] |  |
| V2-4 | V2 配件选项 | 前铲车身同色 | ready; front splitter surfaceColor=body_color | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882393503-c9b2fa454d02a.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Style Library Front splitter 前铲 (表面颜色/材质：车身同色)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=front-bumper/asset_library/Front splitter/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"front-bumper","source":"asset_library","assetId":"front-splitter-style","brand":"Style Library","model":"Front splitter","variant":"前铲","color":"configurable","colorPolicy":"body_color","optionSummary":"表面颜色/材质：车身同色","options":{"surfaceColor":"body_color","surfaceColorLabel":"车身同色"},"referenceImageUrl":"/assets/parts/test-cases/apr-f80-front-splitter.webp","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/apr-f80-front-splitter.webp","uploadToModel":true}]}] |  |
| V2-5 | V2 配件选项 | 侧裙黑色 | ready; side skirt surfaceColor=black | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882393919-3c07df5f53002.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Style Library Side skirts 侧裙 (表面颜色/材质：黑色)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=side-skirts/asset_library/Side skirts/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"side-skirts","source":"asset_library","assetId":"side-skirts-style","brand":"Style Library","model":"Side skirts","variant":"侧裙","color":"configurable","colorPolicy":"part_reference_color","optionSummary":"表面颜色/材质：黑色","options":{"surfaceColor":"black","surfaceColorLabel":"黑色"},"referenceImageUrl":"/assets/parts/test-cases/rsc-f80-side-skirts.webp","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/rsc-f80-side-skirts.webp","uploadToModel":true}]}] |  |
| V2-6 | V2 干碳组合 | 机盖和后视镜裸碳 | ready; dry carbon hood and mirrors are selected | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882394355-1c6ab377085c.jpg / 配件参考图：2 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Dry Carbon Hood 机盖裸碳 (干碳纤维部件：裸露干碳纤维材质) / Dry Carbon Mirror caps 后视镜裸碳 (干碳纤维部件：裸露干碳纤维材质)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=hood/asset_library/Hood/refs:1; mirrors/asset_library/Mirror caps/refs:1<br>providerRefs=2 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"hood","source":"asset_library","assetId":"dry-carbon-hood","brand":"Dry Carbon","model":"Hood","variant":"机盖裸碳","color":"exposed carbon","colorPolicy":"exposed_carbon","optionSummary":"干碳纤维部件：裸露干碳纤维材质","options":{"dryCarbon":true,"dryCarbonPart":"hood"},"referenceImageUrl":"/assets/parts/test-cases/seibon-oe-carbon-hood.jpg","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/seibon-oe-carbon-hood.jpg","uploadToModel":true}]},{"category":"mirrors","source":"asset_library","assetId":"dry-carbon-mirrors","brand":"Dry Carbon","model":"Mirror caps","variant":"后视镜裸碳","color":"exposed carbon","colorPolicy":"exposed_carbon","optionSummary":"干碳纤维部件：裸露干碳纤维材质","options":{"dryCarbon":true,"dryCarbonPart":"mirrors"},"referenceImageUrl":"/assets/parts/test-cases/apr-formula-gt3-mirror.webp","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/apr-formula-gt3-mirror.webp","uploadToModel":true}]}]<br>PASS: [{"category":"hood","source":"asset_library","assetId":"dry-carbon-hood","brand":"Dry Carbon","model":"Hood","variant":"机盖裸碳","color":"exposed carbon","colorPolicy":"exposed_carbon","optionSummary":"干碳纤维部件：裸露干碳纤维材质","options":{"dryCarbon":true,"dryCarbonPart":"hood"},"referenceImageUrl":"/assets/parts/test-cases/seibon-oe-carbon-hood.jpg","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/seibon-oe-carbon-hood.jpg","uploadToModel":true}]},{"category":"mirrors","source":"asset_library","assetId":"dry-carbon-mirrors","brand":"Dry Carbon","model":"Mirror caps","variant":"后视镜裸碳","color":"exposed carbon","colorPolicy":"exposed_carbon","optionSummary":"干碳纤维部件：裸露干碳纤维材质","options":{"dryCarbon":true,"dryCarbonPart":"mirrors"},"referenceImageUrl":"/assets/parts/test-cases/apr-formula-gt3-mirror.webp","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/apr-formula-gt3-mirror.webp","uploadToModel":true}]}] |  |
| L1 | L LLM fallback fixture | vague dark green wording falls back to narrow paint intent | dry run ready; fallback fixture supplies paint target without external AI | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882394768-c783a070956c2.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 深绿色 / 车身高度不变 / no part<br>paint=change:深绿色<br>stance=0<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: {"action":"change","target":"深绿色"}<br>PASS: {"action":"change","target":"深绿色"}<br>PASS: ["form_data","catalog","upload_save","canvas_resolve","guardrail","recognition","local_parse","fallback_intent","fallback_local_parse","standard_json"] |  |
| L2 | L LLM fallback fixture | vague stance wording falls back to narrow stance intent | dry run ready; fallback fixture supplies stance | assistant=Dry run completed. No external AI call was made. / Source canvas: /uploads/chat/vehicle-1784882395226-8742898f46fdd.jpg / Part references: 0 / Summary: chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 竞技 0 指 / no part<br>paint=keep_original:原车漆面<br>stance=70<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: {"value":70,"label":"竞技 0 指"}<br>PASS: ["form_data","catalog","upload_save","canvas_resolve","guardrail","recognition","local_parse","fallback_intent","fallback_local_parse","standard_json"] |  |
| L3 | L LLM fallback fixture | fallback category still asks for missing reference | needs_followup; fallback recognizes rear-wing but local validator asks for reference image | assistant=系统暂未收录该配件尾翼 tail aero 尾翼，请您上传尾翼 tail aero 尾翼的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:rear-wing<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:rear-wing"]<br>PASS: [] |  |
| P1 | P dry carbon parts | old Seibon hood keyword no longer auto-selects catalog asset | needs_followup; old Seibon SKU is not a front catalog hood asset | assistant=The system has not collected Hood add HD14BMWF80-OE hood Hood yet. Please upload reference image(s) for Hood add HD14BMWF80-OE hood Hood.<br>parseStatus=needs_followup<br>missingFields=part_reference:hood<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:hood"]<br>PASS: [] |  |
| P2 | P dry carbon parts | explicit exposed carbon hood proceeds to dry carbon asset | ready; dry-carbon hood selected; colorPolicy=exposed_carbon | assistant=Dry run completed. No external AI call was made. / Source canvas: /uploads/chat/vehicle-1784882396560-c247fd24536338.jpg / Part references: 1 / Summary: chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Dry Carbon Hood 机盖裸碳 (干碳纤维部件：裸露干碳纤维材质)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=hood/asset_library/Hood/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: [{"category":"hood","source":"asset_library","assetId":"dry-carbon-hood","brand":"Dry Carbon","model":"Hood","variant":"机盖裸碳","color":"exposed carbon","colorPolicy":"exposed_carbon","optionSummary":"干碳纤维部件：裸露干碳纤维材质","options":{"dryCarbon":true,"dryCarbonPart":"hood"},"referenceImageUrl":"/assets/parts/test-cases/seibon-oe-carbon-hood.jpg","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/seibon-oe-carbon-hood.jpg","uploadToModel":true}]}] |  |
| P3 | P dry carbon parts | body-color hood SKU no longer auto-selects old asset | needs_followup; body-color hood is no longer a front catalog option | assistant=The system has not collected Hood add body color HD14BMWF80-OE Hood yet. Please upload reference image(s) for Hood add body color HD14BMWF80-OE Hood.<br>parseStatus=needs_followup<br>missingFields=part_reference:hood<br>parts=0 | 正常 | PASS: status=200<br>PASS: partColorPolicyChoiceRequired=false<br>PASS: parseStatus=needs_followup<br>PASS: ["part_reference:hood"]<br>PASS: [] |  |
| P4 | P dry carbon parts | carbon mirror cap keyword proceeds to dry carbon asset | ready; dry-carbon mirrors selected without body-color policy choice | assistant=Dry run completed. No external AI call was made. / Source canvas: /uploads/chat/vehicle-1784882397449-d10a49dbce634.jpg / Part references: 1 / Summary: chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Dry Carbon Mirror caps 后视镜裸碳 (干碳纤维部件：裸露干碳纤维材质)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=mirrors/asset_library/Mirror caps/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: partColorPolicyChoiceRequired=false<br>PASS: [{"category":"mirrors","source":"asset_library","assetId":"dry-carbon-mirrors","brand":"Dry Carbon","model":"Mirror caps","variant":"后视镜裸碳","color":"exposed carbon","colorPolicy":"exposed_carbon","optionSummary":"干碳纤维部件：裸露干碳纤维材质","options":{"dryCarbon":true,"dryCarbonPart":"mirrors"},"referenceImageUrl":"/assets/parts/test-cases/apr-formula-gt3-mirror.webp","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/apr-formula-gt3-mirror.webp","uploadToModel":true}]}] |  |
| P5 | P result correction | mirror color correction uses latest local mirror edit | ready; parts[0]=mirrors/free_text; paint remains keep_original | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882397894-649f80b6a962e.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / 后视镜 free_text<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=mirrors/free_text/mirror color correction/refs:0 | 正常 | PASS: status=200<br>PASS: {"action":"keep_original","target":"原车漆面"}<br>PASS: [{"category":"mirrors","source":"free_text","assetId":"","brand":"","model":"","variant":"mirror color correction","color":"粉色","colorPolicy":"body_color","options":{},"referenceImageUrl":"","referenceImages":[]}]<br>PASS: # Effective Prompt v1 中文有效版

请对第一张上传的原车照片做真实照片局部编辑。第一张上传图片是唯一原车画布；后续上传图片全部是配件参考图，只能参考已选配件的形状、材质和安装关系，绝对不要继承参考图里的其它车辆、背景、光线、相机角度、轮毂、贴纸或未选择部件。

## 模板层
### 通用基础 Prompt - 唯一画布与参考图角色
任务类型：真实照片局部编辑。第一张原车照片是唯一画布，所有输出必须看起来像在这张原图上做局部修图。必须保留原图背景、地面、墙面、车位线、其它车辆、光线方向、反射、阴影、相机角度、裁切范围、车辆位置、车身比例、车牌位置和形状、玻璃、灯组、轮毂、轮胎、黑色塑料饰条、碳纤维件、进气格栅、尾翼和未选择部件。后续图片全部是配件参考图，不是画布，不是车身参考，不是场景参考。

### 对话模式 Prompt - 用户请求转局部编辑
本次生图来自用户自然语言需求。请只执行用户明确要求的改装项，保持请求范围尽量小。若用户上传配件参考图，第一张仍是唯一原车画布，后续图片只用于对应配件的造型、材质、比例和安装意图。若用户提到机盖裸碳、露碳、碳纤维机盖、exposed carbon 或 carbon hood，机盖 colorPolicy 为 exposed_carbon；否则机盖默认 body_color。

## 原车画布
{
  "model": "User uploaded vehicle, preserve exact identity",
  "view": "front three-quarter",
  "sourceImageUrl": "/uploads/chat/vehicle-1784882397894-649f80b6a962e.jpg",
  "confidence": 0.88
}

## 车身颜色
- 动作: keep_original
- 目标: 原车漆面
- 指令: 保持原车车身漆面颜色、色相、光泽、反射和钓金面连续性。

## 已选配件
### 1. 后视镜 (mirrors)
- 来源: free_text
- 参考图:
- 目录颜色: 粉色
- colorPolicy: body_color
- colorPolicyPrompt: Repaint only the mirror caps or mirror housings to 粉色. Preserve mirror glass, mirror shape, mounting base, seams, door panel, window glass, reflections, and every unrelated part.
- 指令: Local correction: repaint only the side mirror caps or mirror housings to 粉色. Keep the rest of the latest image unchanged, including body panels, wheels, lights, glass, background, camera angle, and lighting.
- 分类模板:
后视镜改装只修改后视镜外壳或镜盖材质；本轮只支持裸露干碳纤维开关。必须保留原后视镜形状、角度、镜片位置、边缘缝隙和车门连接结构。碳纤维纹理要细腻，不能让后视镜变形或消失。

## 用户请求
耳朵怎么不是粉色的

## 保留规则
- 必须保留第一张原图中的同一辆车、同一车型、同一车身比例、同一相机角度、同一裁切、同一光照方向、同一反射、同一背景和车牌区域形状。
- 只修改标准 JSON 中已选择的类别。所有未选择配件、轮毂、贴纸、车窗、车门、后视镜、饰条和未选择钣金区域都保持原图。
- 配件比例、透视、遮挡、接触阴影和反光必须符合第一张原车视角。
- 如果某个配件在第一张原车视角中不可见，不要为了展示它而改变相机角度、扩展画面或重画车身另一侧。

## 负向约束
不要重新生成整车，不要换背景，不要换场景，不要换停车场，不要换道路，不要换墙面，不要换光线，不要换相机角度，不要换裁切，不要换车辆位置，不要换车型，不要改变车身比例，不要改变车顶线，不要改变窗线，不要改变轮拱形状，不要改变未选择轮毂，不要把轮毂改成 BBS，不要改变轮胎，不要添加未选择配件，不要添加大尾翼，不要改变未选择尾翼，不要添加排气，不要改变尾灯，不要改变后视镜，不要复制参考图背景，不要复制参考图里的其它车辆，不要复制参考图文字，不要水印，不要人物，不要展厅广告图，不要户外新场景，不要黑色机盖，除非明确要求裸露碳纤维机盖，不要让车身颜色污染玻璃、灯组、轮毂、轮胎、车牌、黑色塑料饰条、碳纤维件、进气格栅、尾翼、背景或地面。 |  |
| P6 | P dry carbon parts | hood keyword with carbon maps to dry carbon hood | ready; dry-carbon hood selected without body-color policy choice | assistant=Dry run completed. No external AI call was made. / Source canvas: /uploads/chat/vehicle-1784882398321-b1d002ffef966.jpg / Part references: 1 / Summary: chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Dry Carbon Hood 机盖裸碳 (干碳纤维部件：裸露干碳纤维材质)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=hood/asset_library/Hood/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: partColorPolicyChoiceRequired=false<br>PASS: [{"category":"hood","source":"asset_library","assetId":"dry-carbon-hood","brand":"Dry Carbon","model":"Hood","variant":"机盖裸碳","color":"exposed carbon","colorPolicy":"exposed_carbon","optionSummary":"干碳纤维部件：裸露干碳纤维材质","options":{"dryCarbon":true,"dryCarbonPart":"hood"},"referenceImageUrl":"/assets/parts/test-cases/seibon-oe-carbon-hood.jpg","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/seibon-oe-carbon-hood.jpg","uploadToModel":true}]}] |  |
| P7 | P part color policy | uploaded carbon hood reference asks policy | partColorPolicyChoiceRequired=true; category=hood | assistant=Should the hood match the body color, or stay exposed carbon?<br>partColorPolicyChoiceRequired=true:hood<br>partColorPolicyChoices=hood<br>parseStatus=needs_followup<br>missingFields=part_color_policy:hood<br>parts=0 | 正常 | PASS: status=200<br>PASS: partColorPolicyChoiceRequired=true<br>PASS: partColorPolicyCategory=hood<br>PASS: ["part_color_policy:hood"] |  |
| P8 | P part color policy | uploaded carbon mirror cap reference asks policy | partColorPolicyChoiceRequired=true; category=mirrors | assistant=Should the mirror caps match the body color, or stay exposed carbon?<br>partColorPolicyChoiceRequired=true:mirrors<br>partColorPolicyChoices=mirrors<br>parseStatus=needs_followup<br>missingFields=part_color_policy:mirrors<br>parts=0 | 正常 | PASS: status=200<br>PASS: partColorPolicyChoiceRequired=true<br>PASS: partColorPolicyCategory=mirrors<br>PASS: ["part_color_policy:mirrors"] |  |
| P8b | P part color policy | uploaded carbon hood and mirror references ask both policies | partColorPolicyChoicesRequired=true; categories=hood,mirrors | assistant=Please confirm the color policy for these carbon-fiber parts: / Hood: Body color / Exposed carbon / Mirrors: Body color / Exposed carbon<br>partColorPolicyChoiceRequired=true:hood<br>partColorPolicyChoices=hood,mirrors<br>parseStatus=needs_followup<br>missingFields=part_color_policy:hood,part_color_policy:mirrors<br>parts=0 | 正常 | PASS: status=200<br>PASS: partColorPolicyChoiceRequired=true<br>PASS: partColorPolicyChoicesRequired=true<br>PASS: [{"categoryId":"hood","categoryLabel":"Hood","options":[{"colorPolicy":"body_color","label":"Body color"},{"colorPolicy":"exposed_carbon","label":"Exposed carbon"}]},{"categoryId":"mirrors","categoryLabel":"Mirrors","options":[{"colorPolicy":"body_color","label":"Body color"},{"colorPolicy":"exposed_carbon","label":"Exposed carbon"}]}]<br>PASS: [{"categoryId":"hood","categoryLabel":"Hood","options":[{"colorPolicy":"body_color","label":"Body color"},{"colorPolicy":"exposed_carbon","label":"Exposed carbon"}]},{"categoryId":"mirrors","categoryLabel":"Mirrors","options":[{"colorPolicy":"body_color","label":"Body color"},{"colorPolicy":"exposed_carbon","label":"Exposed carbon"}]}]<br>PASS: ["part_color_policy:hood","part_color_policy:mirrors"]<br>PASS: ["part_color_policy:hood","part_color_policy:mirrors"] |  |
| P8c | P part color policy | confirmed hood and mirror policies proceed together | ready; uploaded hood and mirrors use confirmed color policies | assistant=Dry run completed. No external AI call was made. / Source canvas: /uploads/chat/vehicle-1784882398935-1f06490883a05.jpg / Part references: 2 / Summary: chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / 机盖 uploaded_reference (exposed carbon) / 后视镜 uploaded_reference<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=hood/uploaded_reference/carbon-hood-reference.jpg/refs:1; mirrors/uploaded_reference/carbon-mirror-caps.jpg/refs:1<br>providerRefs=2 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: partColorPolicyChoiceRequired=false<br>PASS: [{"category":"hood","source":"uploaded_reference","assetId":"","brand":"","model":"","variant":"carbon-hood-reference.jpg","color":"","colorPolicy":"exposed_carbon","options":{},"referenceImageUrl":"/uploads/chat/part-1784882398942-9292c6f60b643.jpg","referenceImages":[{"role":"full_part_reference","url":"/uploads/chat/part-1784882398942-9292c6f60b643.jpg","uploadToModel":true}]},{"category":"mirrors","source":"uploaded_reference","assetId":"","brand":"","model":"","variant":"carbon-mirror-caps.jpg","color":"","colorPolicy":"body_color","options":{},"referenceImageUrl":"/uploads/chat/part-1784882398942-7b1ef7ed147df8.jpg","referenceImages":[{"role":"full_part_reference","url":"/uploads/chat/part-1784882398942-7b1ef7ed147df8.jpg","uploadToModel":true}]}]<br>PASS: [{"category":"hood","source":"uploaded_reference","assetId":"","brand":"","model":"","variant":"carbon-hood-reference.jpg","color":"","colorPolicy":"exposed_carbon","options":{},"referenceImageUrl":"/uploads/chat/part-1784882398942-9292c6f60b643.jpg","referenceImages":[{"role":"full_part_reference","url":"/uploads/chat/part-1784882398942-9292c6f60b643.jpg","uploadToModel":true}]},{"category":"mirrors","source":"uploaded_reference","assetId":"","brand":"","model":"","variant":"carbon-mirror-caps.jpg","color":"","colorPolicy":"body_color","options":{},"referenceImageUrl":"/uploads/chat/part-1784882398942-7b1ef7ed147df8.jpg","referenceImages":[{"role":"full_part_reference","url":"/uploads/chat/part-1784882398942-7b1ef7ed147df8.jpg","uploadToModel":true}]}] |  |
| P9 | P part color policy | explicit exposed carbon mirror cap does not ask | ready; mirror cap selected; colorPolicy=exposed_carbon | assistant=Dry run completed. No external AI call was made. / Source canvas: /uploads/chat/vehicle-1784882399371-09b40010b1a06.jpg / Part references: 1 / Summary: chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Dry Carbon Mirror caps 后视镜裸碳 (干碳纤维部件：裸露干碳纤维材质)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=mirrors/asset_library/Mirror caps/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: partColorPolicyChoiceRequired=false<br>PASS: [{"category":"mirrors","source":"asset_library","assetId":"dry-carbon-mirrors","brand":"Dry Carbon","model":"Mirror caps","variant":"后视镜裸碳","color":"exposed carbon","colorPolicy":"exposed_carbon","optionSummary":"干碳纤维部件：裸露干碳纤维材质","options":{"dryCarbon":true,"dryCarbonPart":"mirrors"},"referenceImageUrl":"/assets/parts/test-cases/apr-formula-gt3-mirror.webp","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/apr-formula-gt3-mirror.webp","uploadToModel":true}]}] |  |
| P10 | P dry carbon parts | dry carbon mirror cap proceeds to dry carbon catalog asset | ready; mirror cap selected; colorPolicy=exposed_carbon | assistant=Dry run completed. No external AI call was made. / Source canvas: /uploads/chat/vehicle-1784882399784-92b0fc58fcd51.jpg / Part references: 1 / Summary: chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / Dry Carbon Mirror caps 后视镜裸碳 (干碳纤维部件：裸露干碳纤维材质)<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=mirrors/asset_library/Mirror caps/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: partColorPolicyChoiceRequired=false<br>PASS: [{"category":"mirrors","source":"asset_library","assetId":"dry-carbon-mirrors","brand":"Dry Carbon","model":"Mirror caps","variant":"后视镜裸碳","color":"exposed carbon","colorPolicy":"exposed_carbon","optionSummary":"干碳纤维部件：裸露干碳纤维材质","options":{"dryCarbon":true,"dryCarbonPart":"mirrors"},"referenceImageUrl":"/assets/parts/test-cases/apr-formula-gt3-mirror.webp","referenceImages":[{"role":"full_part_reference","url":"/assets/parts/test-cases/apr-formula-gt3-mirror.webp","uploadToModel":true}]}] |  |
| S1 | S stance presets | raise ride height maps to raise preset | dry run ready; stance=25 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882400381-bb5595593f4708.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 升高 / no part<br>paint=keep_original:原车漆面<br>stance=25<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: {"value":25,"label":"升高"} |  |
| S2 | S stance presets | flush fitment maps to flush preset | dry run ready; stance=70 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882400796-14a5113695ef.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 竞技 0 指 / no part<br>paint=keep_original:原车漆面<br>stance=70<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: {"value":70,"label":"竞技 0 指"} |  |
| S3 | S stance presets | air suspension wording maps to aired-out preset | dry run ready; stance=90 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882401264-43018717c0cf38.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 气动避震 / no part<br>paint=keep_original:原车漆面<br>stance=90<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: {"value":90,"label":"气动避震"} |  |
| S4 | S stance presets | English air suspension maps to aired-out preset | dry run ready; stance=90 | assistant=Dry run completed. No external AI call was made. / Source canvas: /uploads/chat/vehicle-1784882401744-f6768de26d69e.jpg / Part references: 3 / Summary: chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 气动避震 / Brembo GT Red (卡钳颜色：red；刹车盘：不变)<br>paint=keep_original:原车漆面<br>stance=90<br>context=latest<br>parts=calipers/asset_library/GT/refs:3<br>providerRefs=3 | 正常 | PASS: status=200<br>PASS: {"value":90,"label":"气动避震"} |  |
| S5 | S stance presets | conflicting raise and aired-out stance asks follow-up | needs_followup; user must confirm stance direction | assistant=请确认车身高度要升高，还是降低 / 齐边 / 气动低趴。<br>parseStatus=needs_followup<br>missingFields=stance_preset<br>parts=0 | 正常 | PASS: status=200<br>PASS: parseStatus=needs_followup<br>PASS: ["stance_preset"] |  |
| P11a | P result correction | seed previous paint target for mirror correction | ready; previous standardJson stores paint.target=deep green | assistant=Dry run completed. No external AI call was made. / Source canvas: /uploads/chat/vehicle-1784882402668-f5447ad6a746d8.jpg / Part references: 0 / Summary: chat / User uploaded vehicle, preserve exact identity / 深绿色 / 车身高度不变 / no part<br>paint=change:深绿色<br>stance=0<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: sessionId=chat_5d1d890a<br>PASS: {"action":"change","target":"深绿色"}<br>PASS: {"action":"change","target":"深绿色"} |  |
| P11b | P result correction | mirror correction without color inherits previous paint target | ready; local mirrors correction; prompt inherits previous paint target | assistant=Dry run completed. No external AI call was made. / Source canvas: /uploads/chat/vehicle-1784882402668-f5447ad6a746d8.jpg / Part references: 0 / Summary: chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / 后视镜 free_text<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=mirrors/free_text/mirror color correction/refs:0 | 正常 | PASS: status=200<br>PASS: [{"category":"mirrors","source":"free_text","assetId":"","brand":"","model":"","variant":"mirror color correction","color":"深绿色","colorPolicy":"body_color","options":{},"referenceImageUrl":"","referenceImages":[]}]<br>PASS: # Effective Prompt v1 中文有效版

请对第一张上传的原车照片做真实照片局部编辑。第一张上传图片是唯一原车画布；后续上传图片全部是配件参考图，只能参考已选配件的形状、材质和安装关系，绝对不要继承参考图里的其它车辆、背景、光线、相机角度、轮毂、贴纸或未选择部件。

## 模板层
### 通用基础 Prompt - 唯一画布与参考图角色
任务类型：真实照片局部编辑。第一张原车照片是唯一画布，所有输出必须看起来像在这张原图上做局部修图。必须保留原图背景、地面、墙面、车位线、其它车辆、光线方向、反射、阴影、相机角度、裁切范围、车辆位置、车身比例、车牌位置和形状、玻璃、灯组、轮毂、轮胎、黑色塑料饰条、碳纤维件、进气格栅、尾翼和未选择部件。后续图片全部是配件参考图，不是画布，不是车身参考，不是场景参考。

### 对话模式 Prompt - 用户请求转局部编辑
本次生图来自用户自然语言需求。请只执行用户明确要求的改装项，保持请求范围尽量小。若用户上传配件参考图，第一张仍是唯一原车画布，后续图片只用于对应配件的造型、材质、比例和安装意图。若用户提到机盖裸碳、露碳、碳纤维机盖、exposed carbon 或 carbon hood，机盖 colorPolicy 为 exposed_carbon；否则机盖默认 body_color。

## 原车画布
{
  "model": "User uploaded vehicle, preserve exact identity",
  "view": "front three-quarter",
  "sourceImageUrl": "/uploads/chat/vehicle-1784882402668-f5447ad6a746d8.jpg",
  "confidence": 0.88
}

## 车身颜色
- 动作: keep_original
- 目标: 原车漆面
- 指令: 保持原车车身漆面颜色、色相、光泽、反射和钓金面连续性。

## 已选配件
### 1. 后视镜 (mirrors)
- 来源: free_text
- 参考图:
- 目录颜色: 深绿色
- colorPolicy: body_color
- colorPolicyPrompt: Repaint only the mirror caps or mirror housings to 深绿色. Preserve mirror glass, mirror shape, mounting base, seams, door panel, window glass, reflections, and every unrelated part.
- 指令: Local correction: repaint only the side mirror caps or mirror housings to 深绿色. Keep the rest of the latest image unchanged, including body panels, wheels, lights, glass, background, camera angle, and lighting.
- 分类模板:
后视镜改装只修改后视镜外壳或镜盖材质；本轮只支持裸露干碳纤维开关。必须保留原后视镜形状、角度、镜片位置、边缘缝隙和车门连接结构。碳纤维纹理要细腻，不能让后视镜变形或消失。

## 用户请求
why aren't the mirrors that color

## 保留规则
- 必须保留第一张原图中的同一辆车、同一车型、同一车身比例、同一相机角度、同一裁切、同一光照方向、同一反射、同一背景和车牌区域形状。
- 只修改标准 JSON 中已选择的类别。所有未选择配件、轮毂、贴纸、车窗、车门、后视镜、饰条和未选择钣金区域都保持原图。
- 配件比例、透视、遮挡、接触阴影和反光必须符合第一张原车视角。
- 如果某个配件在第一张原车视角中不可见，不要为了展示它而改变相机角度、扩展画面或重画车身另一侧。

## 负向约束
不要重新生成整车，不要换背景，不要换场景，不要换停车场，不要换道路，不要换墙面，不要换光线，不要换相机角度，不要换裁切，不要换车辆位置，不要换车型，不要改变车身比例，不要改变车顶线，不要改变窗线，不要改变轮拱形状，不要改变未选择轮毂，不要把轮毂改成 BBS，不要改变轮胎，不要添加未选择配件，不要添加大尾翼，不要改变未选择尾翼，不要添加排气，不要改变尾灯，不要改变后视镜，不要复制参考图背景，不要复制参考图里的其它车辆，不要复制参考图文字，不要水印，不要人物，不要展厅广告图，不要户外新场景，不要黑色机盖，除非明确要求裸露碳纤维机盖，不要让车身颜色污染玻璃、灯组、轮毂、轮胎、车牌、黑色塑料饰条、碳纤维件、进气格栅、尾翼、背景或地面。<br>PASS: # Effective Prompt v1 中文有效版

请对第一张上传的原车照片做真实照片局部编辑。第一张上传图片是唯一原车画布；后续上传图片全部是配件参考图，只能参考已选配件的形状、材质和安装关系，绝对不要继承参考图里的其它车辆、背景、光线、相机角度、轮毂、贴纸或未选择部件。

## 模板层
### 通用基础 Prompt - 唯一画布与参考图角色
任务类型：真实照片局部编辑。第一张原车照片是唯一画布，所有输出必须看起来像在这张原图上做局部修图。必须保留原图背景、地面、墙面、车位线、其它车辆、光线方向、反射、阴影、相机角度、裁切范围、车辆位置、车身比例、车牌位置和形状、玻璃、灯组、轮毂、轮胎、黑色塑料饰条、碳纤维件、进气格栅、尾翼和未选择部件。后续图片全部是配件参考图，不是画布，不是车身参考，不是场景参考。

### 对话模式 Prompt - 用户请求转局部编辑
本次生图来自用户自然语言需求。请只执行用户明确要求的改装项，保持请求范围尽量小。若用户上传配件参考图，第一张仍是唯一原车画布，后续图片只用于对应配件的造型、材质、比例和安装意图。若用户提到机盖裸碳、露碳、碳纤维机盖、exposed carbon 或 carbon hood，机盖 colorPolicy 为 exposed_carbon；否则机盖默认 body_color。

## 原车画布
{
  "model": "User uploaded vehicle, preserve exact identity",
  "view": "front three-quarter",
  "sourceImageUrl": "/uploads/chat/vehicle-1784882402668-f5447ad6a746d8.jpg",
  "confidence": 0.88
}

## 车身颜色
- 动作: keep_original
- 目标: 原车漆面
- 指令: 保持原车车身漆面颜色、色相、光泽、反射和钓金面连续性。

## 已选配件
### 1. 后视镜 (mirrors)
- 来源: free_text
- 参考图:
- 目录颜色: 深绿色
- colorPolicy: body_color
- colorPolicyPrompt: Repaint only the mirror caps or mirror housings to 深绿色. Preserve mirror glass, mirror shape, mounting base, seams, door panel, window glass, reflections, and every unrelated part.
- 指令: Local correction: repaint only the side mirror caps or mirror housings to 深绿色. Keep the rest of the latest image unchanged, including body panels, wheels, lights, glass, background, camera angle, and lighting.
- 分类模板:
后视镜改装只修改后视镜外壳或镜盖材质；本轮只支持裸露干碳纤维开关。必须保留原后视镜形状、角度、镜片位置、边缘缝隙和车门连接结构。碳纤维纹理要细腻，不能让后视镜变形或消失。

## 用户请求
why aren't the mirrors that color

## 保留规则
- 必须保留第一张原图中的同一辆车、同一车型、同一车身比例、同一相机角度、同一裁切、同一光照方向、同一反射、同一背景和车牌区域形状。
- 只修改标准 JSON 中已选择的类别。所有未选择配件、轮毂、贴纸、车窗、车门、后视镜、饰条和未选择钣金区域都保持原图。
- 配件比例、透视、遮挡、接触阴影和反光必须符合第一张原车视角。
- 如果某个配件在第一张原车视角中不可见，不要为了展示它而改变相机角度、扩展画面或重画车身另一侧。

## 负向约束
不要重新生成整车，不要换背景，不要换场景，不要换停车场，不要换道路，不要换墙面，不要换光线，不要换相机角度，不要换裁切，不要换车辆位置，不要换车型，不要改变车身比例，不要改变车顶线，不要改变窗线，不要改变轮拱形状，不要改变未选择轮毂，不要把轮毂改成 BBS，不要改变轮胎，不要添加未选择配件，不要添加大尾翼，不要改变未选择尾翼，不要添加排气，不要改变尾灯，不要改变后视镜，不要复制参考图背景，不要复制参考图里的其它车辆，不要复制参考图文字，不要水印，不要人物，不要展厅广告图，不要户外新场景，不要黑色机盖，除非明确要求裸露碳纤维机盖，不要让车身颜色污染玻璃、灯组、轮毂、轮胎、车牌、黑色塑料饰条、碳纤维件、进气格栅、尾翼、背景或地面。 |  |
| F1 | F 多轮追问 | 第 1 轮未收录型号 | 追问上传 ABC999 参考图。 | assistant=系统暂未收录该配件轮毂 ABC999，请您上传轮毂 ABC999的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:wheels<br>parts=0 | 正常 | PASS: status=200<br>PASS: 系统暂未收录该配件轮毂 ABC999，请您上传轮毂 ABC999的配件参考图。 |  |
| F2 | F 多轮追问 | 第 2 轮仍未上传图 | 应继续围绕 ABC999 追问参考图。 | assistant=系统暂未收录该配件轮毂 ABC999，请您上传轮毂 ABC999的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:wheels<br>parts=0 | 正常 | PASS: status=200<br>PASS: 系统暂未收录该配件轮毂 ABC999，请您上传轮毂 ABC999的配件参考图。 |  |
| F3 | F 多轮追问 | 第 3 轮仍未上传图 | 应继续引导上传参考图。 | assistant=系统暂未收录该配件轮毂 ABC999，请您上传轮毂 ABC999的配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:wheels<br>parts=0 | 正常 | PASS: status=200<br>PASS: 系统暂未收录该配件轮毂 ABC999，请您上传轮毂 ABC999的配件参考图。 |  |
| F4 | F 多轮追问 | 第 4 轮仍未上传图 | 应引导去配置模式。 | assistant=已经连续多轮没有拿到可用的配件参考图或可匹配型号。建议先到配置模式选择已收录配件体验，或重新开始对话并上传原车图和清晰配件参考图。<br>parseStatus=needs_followup<br>missingFields=part_reference:wheels<br>parts=0 | 正常 | PASS: status=200<br>PASS: 已经连续多轮没有拿到可用的配件参考图或可匹配型号。建议先到配置模式选择已收录配件体验，或重新开始对话并上传原车图和清晰配件参考图。 |  |
| G1 | G 上下文画布 | 第 1 轮原车改灰 | 创建会话；dry run ready；context=latest。 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882407632-486394d95976d8.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 灰色 / 竞技 0 指 / no part<br>paint=change:灰色<br>stance=70<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: sessionId=chat_40e2feb2<br>PASS: context=latest |  |
| G1b | G context canvas | existing vehicle canvas plus part upload allows empty text | 200 dry run ready; existing session vehicle canvas plus uploaded part image can omit text | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882407632-486394d95976d8.jpg / 配件参考图：1 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 车身高度不变 / 侧裙 uploaded_reference<br>paint=keep_original:原车漆面<br>stance=0<br>context=latest<br>parts=side-skirts/uploaded_reference/side-skirt-primary.jpg/refs:1<br>providerRefs=1 | 正常 | PASS: status=200<br>PASS: dryRun=true<br>PASS: parts=1<br>PASS: {"category":"side-skirts","source":"uploaded_reference","assetId":"","brand":"","model":"","variant":"side-skirt-primary.jpg","color":"","colorPolicy":"part_reference_color","options":{},"referenceImageUrl":"/uploads/chat/part-1784882408260-3b2396ce3a832.jpg","referenceImages":[{"role":"full_part_reference","url":"/uploads/chat/part-1784882408260-3b2396ce3a832.jpg","uploadToModel":true}]} |  |
| G2 | G 上下文画布 | 同会话不传车图 latest 续改 | 不要求上传车图；ready；context=latest；dry run 下 source 复用原始画布。 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882407632-486394d95976d8.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 竞技 0 指 / no part<br>paint=keep_original:原车漆面<br>stance=70<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: context=latest<br>PASS: {"value":70,"label":"竞技 0 指"}<br>PASS: source=/uploads/chat/vehicle-1784882407632-486394d95976d8.jpg; original=/uploads/chat/vehicle-1784882407632-486394d95976d8.jpg |  |
| G3 | G 上下文画布 | 同会话 original 改白色 | 不要求上传车图；ready；context=original；source 为原始画布。 | assistant=Dry run 已完成，没有调用外部 AI。 / 画布：/uploads/chat/vehicle-1784882407632-486394d95976d8.jpg / 配件参考图：0 张 / 摘要：chat / User uploaded vehicle, preserve exact identity / 白色 / 竞技 0 指 / no part<br>paint=change:白色<br>stance=70<br>context=original<br>parts=0 | 正常 | PASS: status=200<br>PASS: context=original<br>PASS: {"action":"change","target":"白色"}<br>PASS: source=/uploads/chat/vehicle-1784882407632-486394d95976d8.jpg; original=/uploads/chat/vehicle-1784882407632-486394d95976d8.jpg |  |
| G5 | G context choice | seed a session with a generated result | ready dry-run session that can be marked as having a generated result | assistant=Dry run completed. No external AI call was made. / Source canvas: /uploads/chat/vehicle-1784882411600-9b669e87cab88.jpg / Part references: 0 / Summary: chat / User uploaded vehicle, preserve exact identity / 白色 / 车身高度不变 / no part<br>paint=change:白色<br>stance=0<br>context=latest<br>parts=0 | 正常 | PASS: status=200<br>PASS: sessionId=chat_1f575954<br>PASS: source=/uploads/chat/vehicle-1784882411600-9b669e87cab88.jpg |  |
| G6 | G context choice | ready request asks for original/latest inside chat | contextChoiceRequired=true before generation when a latest result exists and no new vehicle is uploaded | assistant=Use the original uploaded vehicle photo to regenerate, or continue from the latest generated image?<br>contextChoiceRequired=true<br>parseStatus=ready<br>parts=0 | 正常 | PASS: status=200<br>PASS: contextChoiceRequired=true<br>PASS: Use the original uploaded vehicle photo to regenerate, or continue from the latest generated image? |  |
| G7 | G context choice | confirmed original context proceeds to dry run | confirmed context bypasses the question and produces a standardJson preview | assistant=Dry run completed. No external AI call was made. / Source canvas: /uploads/chat/vehicle-1784882411600-9b669e87cab88.jpg / Part references: 0 / Summary: chat / User uploaded vehicle, preserve exact identity / 原车漆面 / 竞技 0 指 / no part<br>paint=keep_original:原车漆面<br>stance=70<br>context=original<br>parts=0 | 正常 | PASS: status=200<br>PASS: contextChoiceRequired=false<br>PASS: context=original<br>PASS: {"value":70,"label":"竞技 0 指"} |  |

## 异常汇总

无。

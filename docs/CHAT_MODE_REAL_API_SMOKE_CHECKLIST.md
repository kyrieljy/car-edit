# Chat Mode Real API Smoke Checklist

Last reviewed: 2026-05-29 Asia/Shanghai

Context note: manual real-provider checklist only. Use only with explicit user approval for credit-spending tests.

本清单用于手工验证真实 provider 行为。执行前先确认用户同意消耗额度；本轮 P0 不执行真实 API 调用。

## 执行前检查

- 后台 `Chat Mode Workflow` 的生图 provider 已切到目标真实 provider。
- `dry run` 已关闭，且 `DISABLE_EXTERNAL_AI` 未启用。
- 当前账号有可用额度。
- 记录每个 case 的：输入图、用户文本、workflow provider、standardJson、hidden prompt、结果图、失败原因。

## Smoke Cases

1. 颜色-only：上传车辆图，输入“改成珍珠白”。期望车身变色，玻璃、灯、轮毂、轮胎、牌照、黑色塑料、碳纤维、进气格栅、尾翼/扰流板不被覆盖。
2. 车高-齐边：上传车辆图，输入“做齐边低趴”。期望轮胎上沿接近轮眉，轮拱间隙接近 0-1 指宽，不缩放整车，不移动地面。
3. 车高-气动避震：上传车辆图，输入“改成气动避震趴地效果”。期望 aired-out stance，轮眉轻微盖住轮胎上沿，侧裙/前唇非常接近地面，车轮保持圆形。
4. 卡钳改色：上传车辆图，输入“把刹车卡钳改成橙色”。期望只改可见刹车卡钳，不把轮毂或车身改橙。
5. 卡钳品牌追问：上传车辆图，输入“改个 Brembo 卡钳，再改成白色”。期望车身白色 ready，同时追问卡钳品牌/型号或参考图，不凭空生成未确认资产。
6. 碳纤维机盖追问：上传车辆图和碳纤维机盖参考图，输入“装这个机盖”。期望追问“车身同色 / 裸碳”，不自动默认裸碳。
7. 碳纤维后视镜追问：上传车辆图和碳纤维后视镜参考图，输入“换这个后视镜”。期望追问“车身同色 / 裸碳”，不自动默认裸碳。
8. 碳纤维多部件追问：同时上传碳纤维机盖和后视镜参考图。期望一次展示两个 colorPolicy 选择行。
9. 上下文选择：同一会话已有生成结果后，不上传新车图输入“再降低一点”。期望追问使用原图还是上一张结果图。
10. 结果检查-本地：`result_check=mock-vision` 时生成完成后只做本地轻量检查，不应调用外部视觉模型。
11. 结果检查-真实视觉：把 `result_check` 切到真实 vision provider 后，生成完成应调用视觉模型，对比原图和结果图并输出检查摘要。

## 失败记录

每个失败 case 记录：

- provider 和 endpoint。
- HTTP 状态码或 provider 错误。
- 是否发生退款/额度回滚。
- standardJson 是否正确。
- prompt 是否包含预期段落。
- 图片失败是模型能力问题、provider 网络问题，还是本地解析/组装问题。

# Admin Catalog QA Checklist

Last reviewed: 2026-05-29 Asia/Shanghai

Context note: Admin catalog operations reference only. Do not read during normal UI/account handoff.

本文档用于后台资产库运营，不要求一次性批量修完历史数据。每次新增或编辑资产时，按下面项目做 QA。

## 必填信息

- 关键词：必须覆盖品牌、型号、别名、常见中英文叫法和用户可能输入的缩写。
- 展示图：用于前端列表展示，可以不是 provider 最佳参考图。
- Prompt Hint：只写该资产最容易画错的关键视觉特征，不写通用废话。
- Color policy：明确默认策略和允许策略，尤其是机盖、后视镜、碳纤维件。

## 生图参考图

- 普通低风险配件：至少 1 张可上传参考图。
- 高风险配件：建议至少 2 张可上传参考图，优先已安装视角和局部细节。
- `role` 建议：
  - `full_part_reference`：完整外观主参考。
  - `install_context`：已安装在车上的角度。
  - `shape_reference`：形状、轮廓、比例。
  - `material_reference`：材质纹理，如碳纤维。
  - `color_reference`：颜色或漆面效果。
  - `avoid_upload`：只留后台记录，不发给 provider。
- `uploadToModel=false` 只用于会干扰生成的图片，例如包装图、低清图、角度不相关图。

## QA 状态定义

- `untested`：还没有真实或 dry-run prompt 验证。
- `pass`：小样本真实生成可接受。
- `weak`：能生成但稳定性差，需要补参考图或 prompt hint。
- `fail`：不应进入推荐使用，需要修资产或禁用。
- `generationReady=true`：已达到可运营状态。

## 列表筛选含义

- 缺关键词：Chat Mode 很难命中该资产。
- 缺生图参考图：provider 只能依赖展示图或文本，稳定性较差。
- 无可上传参考图：有参考图但都被配置为不上传或 `avoid_upload`。
- Prompt 未测试 / 较弱 / 失败：按 `promptTestStatus` 过滤。
- 未验收：`generationReady=false`。
- 启用但不完整：资产处于 active，但仍缺关键词、参考图、Prompt Hint、验收或 prompt 测试。
- 高风险参考图不足：类别标记为高风险，但可上传参考图少于 2 张。

## Color Policy 建议

- 默认不覆盖：玻璃、灯、轮毂、轮胎、牌照、黑色塑料饰条、碳纤维件、进气格栅、尾翼/扰流板。
- 机盖、后视镜：如果参考图或型号含碳纤维信号，Chat Mode 应追问 `车身同色 / 裸碳`，不要默认裸碳。
- 普通碳纤维外观配件：优先 `part_reference_color`，让材质跟随参考图。

## 验收记录

每次真实测试后建议记录：

- 用户输入。
- standardJson。
- hidden prompt。
- provider。
- 结果图。
- 是否通过。
- 如果失败，是否进入 bad case，以及失败原因。

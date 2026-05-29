# Prompt Real Effect Regression Checklist

Last reviewed: 2026-05-29 Asia/Shanghai

Context note: manual real-provider checklist only. Use only with explicit user approval for credit-spending tests.

本清单只用于小样本真实 API smoke，不在自动测试中执行，避免消耗额度。

## 执行原则

- 每个能力只做 1-2 张代表图。
- 记录 `standardJson`、hidden prompt、provider、结果图和失败原因。
- `result_check` 先保持 `mock/local`，真实 vision 检查只做观察，不默认自动修复。
- 失败样本进入 bad case，不用大批量反复调 prompt。

## Cases

| 能力 | 建议输入 | 通过标准 |
| --- | --- | --- |
| 气动避震 | `改成气动低趴` / Config 选择 `气动避震` | 轮眉轻微盖住轮胎上沿，车身接近地面，车轮圆形和接地点不乱 |
| 齐边低趴 | `轮眉齐边` / Config 选择 `齐边` | 轮胎上沿接近轮眉，轮拱间隙接近 0-1 指宽，不藏轮 |
| 渐变色 | `把车改成渐变色，蓝变紫` / Config 渐变 | 车身漆面前后平滑渐变，玻璃、灯、轮毂、牌照和背景不被改色 |
| 电镀 | `改成电镀银` / Config 自定义色 + 电镀 | 车身钣金呈镜面金属反射，不把玻璃、轮胎、背景一起电镀 |
| 珠光 | `改成珠光米白` / Config 自定义色 + 珠光 | 车身有轻微随光变化的珠光层次，不过度变彩虹 |
| 卡钳改色 | `把刹车卡钳改成橙色` | 只改卡钳颜色，不换轮毂，不改车身颜色 |
| 碳纤维机盖策略 | 上传碳纤维机盖参考图，文本含糊 | 先追问 `机盖：车身同色 / 裸碳`，不直接生成 |
| 碳纤维后视镜策略 | 上传碳纤维后视镜参考图，文本含糊 | 先追问 `后视镜：车身同色 / 裸碳`，不直接生成 |
| 碳纤维机盖 + 后视镜 | 同时上传两张碳纤维参考图 | 一次性展示两个 colorPolicy 选择行 |

## 记录模板

```text
日期：
模式：Chat / Config
输入：
provider：
standardJson：
hidden prompt：
结果图：
结论：pass / weak / fail
失败原因：
是否进入 bad case：
```

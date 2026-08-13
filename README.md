# dsh-plugin-verify

**DSH（DeepSeek Harness）生态的可信插件守门人**——验证为准入，判定为核心，目录为货架，内容为复利。

`verify` 在这里是双关：**验证动作**（一条命令跑运行时检查）+ **判定结果**（Verified 徽标 = 通过审查的插件）。

---

## 为什么存在

DSH 插件生态有个真空：**观测很多，判定没有**。

- [awesome-dsh-plugins](https://github.com/AdamPlatin123/awesome-dsh-plugins) 是优秀的**观测雷达**——它收录一切、标记六种状态，但明确"不合并成兼容率、不背书、不是包管理器"（它自己的 README 说的）。
- **"哪个插件值得装？"** 这个问题，生态里没人回答。

dsh-plugin-verify 填的就是这个真空：**做判定**。每个插件经过同一套运行时审查，通过 = 拿到 Verified 徽标，进入可信目录。

## 它是什么（三合一）

| 组件 | 是什么 | 对应生态位 |
|---|---|---|
| **dsh-plugin-verify CLI** | 一条命令跑完整运行时验证，产出报告 | 验证能力（护城河） |
| **Verified 徽标** | 通过审查的判定信号 | 判定（差异化，awesome 不做） |
| **Verified DSH Plugins 目录** | 只收通过验证的插件 + 一键安装入口 | 货架（信任溢出成交易） |

## 快速开始

```bash
# 前提：DSH 源码 checkout 已构建（build:lib:host + build:lib:client）
npx dsh-plugin-verify <你的插件路径> --repo <DSH checkout>
# ✅ 通过 | 捕获事件: 13 | waterfall: 7/7 | tools/result: 是
# 报告: ./verify-report.json
```

退出码：`0` 通过 / `1` 未通过 / `2` 环境错误。

## 验证标准（判定规则，公开透明）

用 mock-llm 触发真实 agent 循环（`tool_call_success` → bash 工具调用），检查整条 waterfall 链：

```
system-prompt/assemble → agent/pre-step → agent/request → llm/stream
→ tools/pre-execute → tools/execute → tools/post-execute → tools/result
```

**通过 = 7/7 waterfall 链完整 + `tools/result` 收尾**。含义：插件的 waterfall 监听器正确透传了 `next()`，零副作用——这是插件"不会静默破坏 agent 行为"的最强证明。

判定基于**当日 mainline**；DSH 每天更新，插件可能漂移，报告标注日期，可复核。

## Verified 徽标

通过验证的插件获得徽标并进入目录：

| 徽标 | 含义 |
|---|---|
| ✅ Verified | 已通过运行时验证（当日 mainline、证据可复现） |

**徽标 ≠ 官方背书**。它是社区判定：在"这个插件能装"和"这个插件不会破坏 agent 循环"之间划了一条可信的线。

## 插件作者：如何获得 Verified 徽标

1. 准备 DSH checkout + 你的插件
2. `npx dsh-plugin-verify <你的插件> --repo <DSH checkout>`
3. 通过 → 提 PR/Issue 收录进 [Verified 目录](https://qing3a.github.io/dsh-plugin-verify/)（附 `verify-report.json`）

**为什么要来**：在 awesome 的"待测/未知"海洋里，Verified 徽标让你脱颖而出；验证流程还会帮你发现真实 bug（[dsh-sentinel 案例](https://github.com/fuhefei/dsh-sentinel/issues/4)：headless 加载失败被验证工具抓出）。

## 使用者：如何安装可信插件

从目录选一个 ✅ Verified 插件，然后：

```bash
dsh plugin --profile web add <插件包名>
```

（安装命令以插件自身 README 为准；Verified 徽标保证它至少通过了运行时审查。）

## 证据与报告

- `verify-report.json`：插件/DSH 路径、日期、pass、waterfall 链明细——**可复现，不是口头结论**
- 报告归档在目录页，每插件一份
- 验证方法学：[官方 Discussion 462](https://github.com/deepseek-ai/deepseek-harness/discussions/462)

## 与 awesome-dsh-plugins 的关系（互补，不竞争）

| | awesome-dsh-plugins | dsh-plugin-verify |
|---|---|---|
| 角色 | 观测雷达（收录一切） | 可信守门人（只收审查通过的） |
| 输出 | 6 种观测状态，不判定 | ✅ Verified 判定 |
| 交付 | 不是包管理器 | 一键安装入口 |
| 关系 | 它的验证报告可作为我们收录的证据 | 我们的 Verified 徽标可回填它的"运行可用"层 |

## 文章

- [从零拆解 DSH 插件集（一）：dsh-web-ui 全景与插件集范式](posts/01-dsh-web-ui-拆解.md)
- [从零写一个 DSH 插件并跑通：踩坑全记录（二）](posts/02-从零写DSH插件踩坑全记录.md)
- [无 API Key 验证 DSH 插件：mock-llm 实战与 waterfall 捕获实证（三）](posts/03-无APIKey验证DSH插件.md)

## 开发

```bash
pnpm install
pnpm build                # CLI（src/）
cd auditor && pnpm install && npx tsc -p tsconfig.json   # 审计器
```

## 许可

MIT

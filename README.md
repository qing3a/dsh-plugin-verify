# dsh-plugin-verify — Verified DSH Plugins

> DSH 插件**判定站**：每个插件经过同一套运行时验证（7/7 waterfall + tools/result），通过才给 ✅ Verified 徽标。**与 awesome-dsh-plugins（全量分级观测）互补：它做 L0-L4 全量观测分级，我们把 L4 运行实测做深（7/7 waterfall + tools/result）。**

![verified](https://img.shields.io/badge/Verified%20插件-4-blue) ![runtime](https://img.shields.io/badge/判定-运行时实测-green) ![method](https://img.shields.io/badge/方法论-官方Discussion%23462-green)

- **找可信插件**：按功能分类浏览，每个插件带 Verified 徽标 + 验证日期 + 可复现报告——证据可复现的运行时验证（7/7 waterfall + tools/result）
- **装得放心**：徽标 = 通过了完整 agent 循环审查；附带安装指引与安全提示
- **给插件做判定**：插件作者一条命令跑验证拿徽标；顺带帮你发现真实 bug

[浏览 Verified 目录](#verified-目录) · [判定规则](#判定规则) · [插件作者：拿徽标](#插件作者如何获得-verified-徽标) · [使用者：安全安装](#使用者如何安全安装) · [贡献者](#贡献者)

> [!IMPORTANT]
> **Verified 徽标 ≠ 官方背书。** 判定基于当日 mainline、证据可复现；DSH 每天更新，插件可能漂移，安装前请查看验证日期与插件自身 README。

## 从这里开始

| 你的目标 | 跳转入口 |
|---|---|
| 找一个可信插件 | [Verified 目录](#verified-目录) |
| 投稿你的插件（上架） | [插件作者：投稿](#插件作者投稿你的插件2-分钟上架) |
| 看懂徽标/状态 | [状态体系](#状态体系) |
| 安全安装插件 | [使用者](#使用者如何安全安装) |
| 想了解判定凭什么 | [判定规则](#判定规则) |
| 提交/维护 | [贡献者](#贡献者) |
| 了解边界 | [边界与免责](#边界与免责) |

## 状态体系

| 徽标 | 状态 | 含义 | 它不说明什么 |
|---|---|---|---|
| ✅ **Verified** | 已验证 | 通过完整运行时验证（7/7 waterfall + tools/result），证据可复现 | 非官方背书、非全功能测试、非安全审计 |
| ⏳ **未验证** | 未验证 | 已收录但尚未运行时验证 | 不代表坏，只是还没测 |
| ❌ **验证失败** | 失败 | 运行时验证发现问题（有报告） | 不代表永远不可用，修复后可复测 |

> 每个判定附带四项：**插件 commit · mainline commit · 验证日期 · 报告**。缺一项即降低信任等级。

## Verified 目录

> 更新于 2026-08-14 · 判定方法：[dsh-plugin-verify CLI](#插件作者如何获得-verified-徽标)

### 🛠 调试与观测（Debug & Observability）

*事件审计、会话诊断、运行观测——让插件作者/开发者看清 harness 内部发生了什么*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [dsh-event-auditor](https://github.com/qing3a/dsh-event-auditor) | ✅ | harness 事件流审计面板：事件类型/分发模式/计数；settings 热改 + /audit 命令 + headless dump | 2026-08-14 | [view](reports/event-auditor-2026-08-14.json) |

### 🖥 桌面与系统（Desktop & System）

*系统级集成：托盘驻留、桌面外壳、原生能力桥接*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [dsh-tray](https://github.com/qing3a/dsh-tray) | ✅ | Windows 系统托盘（trayicon exe 宿主，无 native 编译）：菜单/通知/headless 降级 | 2026-08-14 | [view](reports/tray-2026-08-14.json) |

### 🔒 安全与合规（Security & Compliance）

*密钥扫描、危险模式检测、合规工具*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [dsh-security-scan](https://github.com/ben7am1n/dsh-security-scan) | ✅ | Secret & dangerous-pattern scanner（zero deps） | 2026-08-14 | [view](reports/security-scan-2026-08-14.json) |

### 📊 效率与监控（Productivity & Monitoring）

*Token 消耗、账户余额、运行指标——成本与资源可见性*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [dsh-balance](https://github.com/TwotwoPiggy/dsh-balance) | ✅ | Web 聊天框实时 Token 消耗估算 + DeepSeek 账户余额（纯 JS，ctx.inject 动态注入） | 2026-08-14 | [view](reports/balance-2026-08-14.json) |

### 💻 编码开发（Coding & Development）

*代码操作、git 集成、终端、文档生成、工具适配器*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [falsify-dsh](https://github.com/shi275773124/falsify-dsh) | ✅ | Falsify CLI 适配器：裁决收据（lint / review --json / gate） | 2026-08-14 | [view](reports/falsify-2026-08-14.json) |

> 你的插件还没在？[拿徽标只要 2 分钟](#插件作者如何获得-verified-徽标)。

## 判定规则（透明公开）

**为什么是运行时判定**：静态检查只能证明"能加载"，证明不了"不破坏行为"。waterfall 监听器漏调 `next()` 会静默吞掉 agent 的默认行为——这类 bug 只有真实循环才暴露。

**判定流程**（mock-llm 触发完整 agent 循环，`tool_call_success` → 平台 shell 工具调用——Windows 用 `pwsh`、非 Windows 用 `bash`，见 `docs/runtime-validation.md` 平台边界）：

```
system-prompt/assemble → agent/pre-step → agent/request → llm/stream
→ tools/pre-execute → tools/execute → tools/post-execute → tools/result
```

**通过标准**：7/7 waterfall 链完整 + `tools/result` 收尾（零副作用）+ **R3**（目标工具真实执行成功——`tools/result` 载荷 `isError:false`；目标工具本身 `UNKNOWN_TOOL` 判失败，postmortem 0002 教训）。

**报告怎么读**（`verify-report.json`）：

```json
{ "pass": true, "waterfallFound": [7/7 事件], "waterfallMissing": [],
  "rules": [{"name":"R1-entry-shape","pass":true,...},{"name":"R2-patch-yaml","pass":true,...},{"name":"R3-tools-result","pass":true,...}],
  "detail": "捕获事件: 13 | tools/result: 是" }
```

- `pass: true` + `missing: []` + `rules[]` 全 `pass` = ✅ 通过
- `missing` 列出哪段链没出现 → 定位插件哪个 waterfall 监听器有问题
- `rules[]`：R1（入口形态，postmortem 0001 unwrapExports 陷阱）、R2（`!!js` 只在 config 子树，postmortem 0002）、R3（`UNKNOWN_TOOL` 运行时判失败，postmortem 0002 快照教训）——静态规则是确定性信号，最终以运行时判定为准
- 每份报告含插件路径、DSH checkout、日期 → 可复现
- 人工评审层：`docs/review-checklist.md`（官方 defensive-patterns 7 条 + postmortem 检查点）

## 插件作者：投稿你的插件（2 分钟上架）

**这里是一个插件市场，不是一个清单。** 投稿 = 验证 + 上架 = 获得徽标 + 被发现 + 被安装。

> 📐 生态尚无官方插件规范——判定站配套了[《DSH 插件开发与设计规范建议 v0.1》](docs/plugin-standards.md)（基于官方源码分析与官方风格提炼，每条带依据与踩坑记录，避免重复试错）。投稿 = 声明符合规范建议 + 通过判定。

```bash
# 1. 准备 DSH checkout（已 build:lib:host && build:lib:client）
# 2. 跑验证
npx dsh-plugin-verify <你的插件路径> --repo <DSH checkout>
# ✅ 通过 | 捕获事件: 13 | waterfall: 7/7 | tools/result: 是
# 3. 通过后提交收录（见下）
# 4. 上架 → 获得徽标，进入分类目录
```

**投稿方式**（任选）：
- **用投稿 Skill（推荐，agent 友好）**：读 [skills/submission/SKILL.md](skills/submission/SKILL.md)——按 6 步流程生成提交包（manifest + self_check + verify-report），跑 [check-submission.mjs](scripts/check-submission.mjs) 自检 gate，通过后提 PR。DSH 生态的 agent 作者可直接遵循此 skill 自动投稿。
- **提 PR**：在 `index.html` 的对应分类表格加一行（含报告链接）
- **提 Issue**：附上 `verify-report.json` 链接，说明插件名/仓库/分类/一句话描述

**为什么要投稿**：
- 在 288+ 个插件的"待测/未知"海洋里，✅ 徽标让你**脱颖而出**
- 验证会**帮你发现真实 bug**（[dsh-sentinel 案例](https://github.com/fuhefei/dsh-sentinel/issues/4)：headless 加载失败被验证工具抓出）
- 报告可直接作为 [awesome-dsh-plugins](https://github.com/AdamPlatin123/awesome-dsh-plugins) 登记 PR 的运行实测证据（其 L4 层）
- 收录进分类目录 → 用户/AI 按功能找你 → 被安装

**收录条件**：公开仓库 + `dsh-plugin` topic + 合法 package.json + 运行时依赖声明 + 许可证 + README（含安装/卸载/最小示例）。命名用你有权控制的 scope，不占 `@deepseek-ai/*` 保留命名空间。

## 使用者：如何安全安装

1. 从[目录](#verified-目录)选 ✅ Verified 插件
2. 查看验证日期（久于一周需谨慎——DSH 每天更新）与[报告](#判定规则公开透明)
3. `dsh plugin --profile web add <插件包名>`（以插件自身 README 为准）
4. 先在隔离 profile 试加载，不提供生产密钥
5. 保留配置与锁文件，失败可回滚

> ⚠️ 安装任何第三方插件前：查看源码、权限、依赖、许可证与验证日期。徽标 ≠ 安全审计。

## 贡献者

- **提交新验证**：验证通过 → PR 收录进目录（附 `verify-report.json`）；修正链接/分类/描述 → 小 PR 即可
- **报告新发现**：验证失败或有疑问 → issue（附 `verify-report.json` 与复现步骤）
- **不要**在 PR 里复制私有 issue、密钥、成员信息或大段第三方内容

## 边界与免责

- **徽标 ≠ 官方背书** ≠ 完整功能测试 ≠ 安全审计；只证明"在记录的环境与 commit 上通过了运行时审查"
- **与 [awesome-dsh-plugins](https://github.com/AdamPlatin123/awesome-dsh-plugins) 的关系**：它做全量分级观测（L0 发现 → L1 清单 → L2 静态兼容 → L3 编译 → L4 运行实测，288 仓库）；我们聚焦 **L4 运行实测并做深**（7/7 waterfall + tools/result 零副作用）——**互补：它给全量分级信号，我们给深度可信结论**，读者可互跳

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
- [把方法论变成一条命令：dsh-plugin-verify 从零到跑通（四）](posts/04-dsh-plugin-verify从零到跑通.md)

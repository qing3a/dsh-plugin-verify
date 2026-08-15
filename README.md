# dsh-plugin-verify — Verified DSH Plugins

> DSH 插件**判定站**：每个插件经过同一套运行时验证（7/7 waterfall + tools/result），通过才给 ✅ Verified 徽标。**与 awesome-dsh-plugins（全量分级观测）互补：它做 L0-L4 全量观测分级，我们把 L4 运行实测做深（7/7 waterfall + tools/result）。**

![verified](https://img.shields.io/badge/Verified%20插件-9-blue) ![runtime](https://img.shields.io/badge/判定-运行时实测-green) ![reports](https://img.shields.io/badge/可复现报告-9-green) ![method](https://img.shields.io/badge/方法论-官方Discussion%23462-green)

- **找可信插件**：按功能分类浏览，每个插件带 Verified 徽标 + 验证日期 + 可复现报告——证据可复现的运行时验证（7/7 waterfall + tools/result）
- **装得放心**：徽标 = 通过了完整 agent 循环审查；附带安装指引与安全提示
- **给插件做判定**：插件作者一条命令跑验证拿徽标；顺带帮你发现真实 bug

---

## 📑 门户导航

**快速路由**——按你的身份/目标直达：

| 你的目标 | 跳转入口 |
|---|---|
| 找一个可信插件 | [Verified 目录](#verified-目录) |
| 投稿你的插件（2 分钟上架） | [插件作者：投稿](#插件作者投稿你的插件2-分钟上架) |
| 看懂徽标/状态 | [状态体系](#状态体系) |
| 安全安装插件 | [使用者：如何安全安装](#使用者如何安全安装) |
| 想了解判定凭什么 | [判定规则](#判定规则透明公开) |
| 浏览全部资源（方法论/报告/文章/工具） | [资源中心](#资源中心) |
| 提交/维护 | [贡献者](#贡献者) |
| 了解边界 | [边界与免责](#边界与免责) |

**资源总览**——本项目全部资产的陈列入口：

| 资产 | 内容 | 入口 |
|---|---|---|
| **判定站主页** | 分类目录 + 数字卡片 + 投稿 CTA（GitHub Pages） | [index.html](index.html) |
| **验证 CLI** | 一条命令跑运行时验证（mock-llm + waterfall + rules[]） | `npx dsh-plugin-verify <插件路径> --repo <DSH checkout>` |
| **验证方法论** | 无 API Key 验证 waterfall 行为：mock-llm / headless / dump 完整路径 | [docs/runtime-validation.md](docs/runtime-validation.md) · [Discussion 462](https://github.com/deepseek-ai/deepseek-harness/discussions/462) |
| **插件规范建议** | 《DSH 插件开发与设计规范建议 v0.1》（每条带依据与踩坑记录） | [docs/plugin-standards.md](docs/plugin-standards.md) |
| **评审清单** | 人工评审层：官方 defensive-patterns + postmortem 检查点 | [docs/review-checklist.md](docs/review-checklist.md) |
| **审核标准** | 评审标准总纲 v0.1.0：P（插件必检）/D（dsh-desktop 基线）/C（官方贡献）三集规则，钉定 mainline `47f94385`，含版本规程与溯源修正 | [docs/review-standards.md](docs/review-standards.md) |
| **验证报告** | 9 份可复现报告（插件 commit · mainline commit · 验证日期） | [reports/](#资源中心) |
| **文章** | 从零拆解 / 踩坑全记录 / 验证实战 / 判定站从零到跑通（4 篇） | [posts/](#文章) |
| **投稿系统** | Agent 友好的 6 步投稿 Skill + 自检 gate | [skills/submission/SKILL.md](skills/submission/SKILL.md) |

> [!IMPORTANT]
> **Verified 徽标 ≠ 官方背书。** 判定基于当日 mainline、证据可复现；DSH 每天更新，插件可能漂移，安装前请查看验证日期与插件自身 README。

---

## ✅ 状态体系

| 徽标 | 状态 | 含义 | 它不说明什么 |
|---|---|---|---|
| ✅ **Verified** | 已验证 | 通过完整运行时验证（7/7 waterfall + tools/result），证据可复现 | 非官方背书、非全功能测试、非安全审计 |
| ⏳ **未验证** | 未验证 | 已收录但尚未运行时验证 | 不代表坏，只是还没测 |
| ⓘ **环境边界** | 静态通过、运行时未激活 | headless 判定环境缺其依赖服务（web 重依赖/特定注入），属判定方法边界而非插件缺陷 | 不代表坏；在完整 web profile 下可能工作正常，需换环境复验 |
| ❌ **验证失败** | 失败 | 运行时验证发现问题（有报告） | 不代表永远不可用，修复后可复测 |

> 每个判定附带四项：**插件 commit · mainline commit · 验证日期 · 报告**。缺一项即降低信任等级。

---

## 🗂 Verified 目录

> 更新于 2026-08-15 · 判定方法：[dsh-plugin-verify CLI](#插件作者投稿你的插件2-分钟上架)

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
| [DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) | ⓘ | 服务化侧栏框架：右侧栏+底部面板双工作台（文件/编辑预览/内嵌浏览器/真实终端/Git/后台任务）；`ctx.betterSidebar` 服务开放给第三方插件注册 tab/viewer；只注册 `settings.section`（未碰 single 槽） | 2026-08-15 复验 | — |

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
| [dsh-automation](https://github.com/titanwings/dsh-automation) | ⓘ | 定时/自动化任务调度：cron 触发、并发限制、人工审批门、历史回放；`automationDomainSpec` 数据域（依赖 zod/luxon，非 zero-dep） | 2026-08-15 复验 | — |

### 💻 编码开发（Coding & Development）

*代码操作、git 集成、终端、文档生成、工具适配器*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [dsh-repo-context](https://github.com/qing3a/dsh-repo-context) | ✅ | 把 git 状态与仓库规范动态注入 system prompt（section/context/variable，官方缝隙插件） | 2026-08-14 | [view](reports/repo-context-2026-08-14.json) |
| [falsify-dsh](https://github.com/shi275773124/falsify-dsh) | ✅ | Falsify CLI 适配器：裁决收据（lint / review --json / gate） | 2026-08-14 | [view](reports/falsify-2026-08-14.json) |
| [dsh-at-file](https://github.com/omdsh-dev/dsh-at-file) | ✅ | Codex 风格 @path 引用：对话里 `@路径` 解析为文件上下文（agent/pre-step 瀑布注入），客户端注入 ui-input-trigger/ui-slots | 2026-08-15 | [view](reports/at-file-2026-08-15.json) |
| [dsh-genui](https://github.com/omdsh-dev/dsh-genui) | ✅ | ```dsh-ui fence 生成 UI：模型用 DSL 声明界面，client 渲染器 + settings.section 注册 | 2026-08-15 | [view](reports/genui-2026-08-15.json) |

### 🧠 模型能力增强（Model Capabilities）

*补足基础模型缺失的模态/能力：视觉、多模态理解*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [ModLens](https://github.com/liustack/modlens) | ✅ | 首个 DSH 视觉插件：聊天直接粘贴图片 → 文本模型获得视觉（image→文本引擎），注入 tools/agents/attachments/llm（入口走 package.json `exports` 而非 `main`，实测加载正常） | 2026-08-15 | [view](reports/modlens-2026-08-15.json) |

> **2026-08-15 收录批次**（5 个）：dsh-at-file · dsh-genui · dsh-automation · DSH-better-sidebar · ModLens——静态校验（R1 入口形态 + R2 patch YAML）全部通过，运行时验证（7/7 waterfall + tools/result）：**3 通过升级 ✅**（at-file / genui / modlens，报告已附），**2 标 ⓘ 环境边界**（automation inject `storageDomain` 等服务 headless 不提供、better-sidebar 缺 `lib/` 构建产物且 inject webServer 等 web 服务——均非插件行为缺陷，需在完整 web profile 复验）。静态注意项实测结论：genui 缺 `name` 导出（loader 用 entry id 兜底）与 modlens 走 `exports` 入口均**加载正常**，判定站 R1 的检测盲区已用运行时验证补上。

> 你的插件还没在？[拿徽标只要 2 分钟](#插件作者投稿你的插件2-分钟上架)。

---

## 🔬 判定规则（透明公开）

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

---

## 📦 资源中心

本项目一切资产的陈列与索引。主页（index.html）是给读者的目录，这里是给开发者/作者的完整资源清单。

### 方法论文档

| 文档 | 用途 |
|---|---|
| [docs/runtime-validation.md](docs/runtime-validation.md) | 完整验证方法论：mock-llm / headless / dump 环境变量、平台边界（Windows pwsh vs bash）、"recovered ≠ 工具成功"警示 |
| [docs/plugin-standards.md](docs/plugin-standards.md) | 《DSH 插件开发与设计规范建议 v0.1》：官方源码分析提炼，每条带依据与踩坑 |
| [docs/review-checklist.md](docs/review-checklist.md) | 人工评审层：官方 defensive-patterns 7 条 + postmortem 0001-0004 检查点 |
| [docs/review-standards.md](docs/review-standards.md) | **评审标准总纲 v0.1.0**：P（插件必检）/D（dsh-desktop 基线）/C（官方贡献）三集规则；R1/R2/R3 的统一索引；钉定 mainline `47f94385`；含规则生命周期与版本规程 |
| [docs/source/dsh-design-conventions.md](docs/source/dsh-design-conventions.md) | 《DSH 设计规范整理》溯源源稿（复制入库，40 条依据路径已逐条对照源码验证） |
| [Discussion 462](https://github.com/deepseek-ai/deepseek-harness/discussions/462) | 官方 Show and tell：无 API Key 验证 waterfall 行为的方法论帖（含完整命令与实证） |

### 验证报告（reports/）

每份报告含插件 commit / mainline commit / 验证日期，可复现。**验证日期久于一周需谨慎——DSH 每天更新。**

| 插件 | 报告 | 状态 |
|---|---|---|
| dsh-event-auditor | [reports/event-auditor-2026-08-14.json](reports/event-auditor-2026-08-14.json) | ✅ |
| dsh-tray | [reports/tray-2026-08-14.json](reports/tray-2026-08-14.json) | ✅ |
| dsh-security-scan | [reports/security-scan-2026-08-14.json](reports/security-scan-2026-08-14.json) | ✅ |
| dsh-balance | [reports/balance-2026-08-14.json](reports/balance-2026-08-14.json) | ✅ |
| dsh-repo-context | [reports/repo-context-2026-08-14.json](reports/repo-context-2026-08-14.json) | ✅ |
| falsify-dsh | [reports/falsify-2026-08-14.json](reports/falsify-2026-08-14.json) | ✅ |
| dsh-at-file | [reports/at-file-2026-08-15.json](reports/at-file-2026-08-15.json) | ✅ |
| dsh-genui | [reports/genui-2026-08-15.json](reports/genui-2026-08-15.json) | ✅ |
| ModLens | [reports/modlens-2026-08-15.json](reports/modlens-2026-08-15.json) | ✅ |

> 报告均为 2026-08-14 用修正后 CLI（rules[] + R3）绝对路径重验版本，非早期空转版本。

### 工具与脚本

| 工具 | 用途 |
|---|---|
| `npx dsh-plugin-verify <插件路径> --repo <DSH checkout>` | 验证 CLI：mock-llm + headless + waterfall 捕获 + rules[] 判定 |
| [scripts/check-submission.mjs](scripts/check-submission.mjs) | 投稿自检 gate：验证提交包（manifest + self_check + verify-report）是否齐全 |
| [scripts/static-rules.mjs](scripts/static-rules.mjs) | 静态规则（R1/R2/R3）——确定性信号，最终以运行时判定为准 |
| [scripts/radar-upgrade-pr.mjs](scripts/radar-upgrade-pr.mjs) | 批量把已验证插件在 awesome-dsh-plugins 登记为运行级 ✅ 的 PR 脚本 |
| [skills/submission/SKILL.md](skills/submission/SKILL.md) | Agent 友好的投稿 Skill：6 步生成提交包（manifest + self_check + verify-report） |

### 文章

从作者视角到方法论沉淀的完整博客序列：

- [01 · 从零拆解 DSH 插件集（一）：dsh-web-ui 全景与插件集范式](posts/01-dsh-web-ui-拆解.md)
- [02 · 从零写一个 DSH 插件并跑通：踩坑全记录（二）](posts/02-从零写DSH插件踩坑全记录.md)
- [03 · 无 API Key 验证 DSH 插件：mock-llm 实战与 waterfall 捕获实证（三）](posts/03-无APIKey验证DSH插件.md)
- [04 · 把方法论变成一条命令：dsh-plugin-verify 从零到跑通（四）](posts/04-dsh-plugin-verify从零到跑通.md)

### 生态入口

| 入口 | 说明 |
|---|---|
| [awesome-dsh-plugins](https://github.com/AdamPlatin123/awesome-dsh-plugins) | DSH 插件全量分级观测（L0-L4）；我们的运行实测证据可用于其 L4 登记 |
| [deepseek-harness 官方仓库](https://github.com/deepseek-ai/deepseek-harness) | DSH 本体；插件跑在它之上 |

---

## 🚀 插件作者：投稿你的插件（2 分钟上架）

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

---

## 🛡 使用者：如何安全安装

1. 从[目录](#verified-目录)选 ✅ Verified 插件
2. 查看验证日期（久于一周需谨慎——DSH 每天更新）与[报告](#资源中心)
3. `dsh plugin --profile web add <插件包名>`（以插件自身 README 为准）
4. 先在隔离 profile 试加载，不提供生产密钥
5. 保留配置与锁文件，失败可回滚

> ⚠️ 安装任何第三方插件前：查看源码、权限、依赖、许可证与验证日期。徽标 ≠ 安全审计。

---

## 🤝 贡献者

- **提交新验证**：验证通过 → PR 收录进目录（附 `verify-report.json`）；修正链接/分类/描述 → 小 PR 即可
- **报告新发现**：验证失败或有疑问 → issue（附 `verify-report.json` 与复现步骤）
- **不要**在 PR 里复制私有 issue、密钥、成员信息或大段第三方内容

---

## 📐 边界与免责

- **徽标 ≠ 官方背书** ≠ 完整功能测试 ≠ 安全审计；只证明"在记录的环境与 commit 上通过了运行时审查"
- **与 [awesome-dsh-plugins](https://github.com/AdamPlatin123/awesome-dsh-plugins) 的关系**：它做全量分级观测（L0 发现 → L1 清单 → L2 静态兼容 → L3 编译 → L4 运行实测，288 仓库）；我们聚焦 **L4 运行实测并做深**（7/7 waterfall + tools/result 零副作用）——**互补：它给全量分级信号，我们给深度可信结论**，读者可互跳
- 验证报告目录可被任何 DSH 插件市场引用为运行时证据（verifiedBy / verifiedAt / reportUrl）

---

## 🛠 开发

```bash
pnpm install
pnpm build                # CLI（src/）
cd auditor && pnpm install && npx tsc -p tsconfig.json   # 审计器
```

## 许可

MIT

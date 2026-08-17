# dsh-plugin-verify — Verified DSH Plugins

> DSH 插件**判定站**：每个插件经过同一套运行时验证（7/7 waterfall + tools/result），通过才给 ✅ Verified 徽标。**与 awesome-dsh-plugins（全量分级观测）互补：它做 L0-L4 全量观测分级，我们把 L4 运行实测做深（7/7 waterfall + tools/result）。**

![verified](https://img.shields.io/badge/Verified%20插件-18-blue) ![runtime](https://img.shields.io/badge/判定-运行时实测-green) ![reports](https://img.shields.io/badge/可复现报告-18-green) ![method](https://img.shields.io/badge/方法论-官方Discussion%23462-green)

- **找可信插件**：按场景浏览，每个插件带 Verified 徽标 + 验证日期 + 可复现报告——证据可复现的运行时验证（7/7 waterfall + tools/result）
- **装得放心**：徽标 = 通过了完整 agent 循环审查；附带安装指引与安全提示
- **给插件做判定**：插件作者一条命令跑验证拿徽标；顺带帮你发现真实 bug

---

## 📑 门户导航

**快速路由**——按你的身份/目标直达：

| 你的目标 | 跳转入口 |
|---|---|
| 找一个可信插件 | [场景目录](#-场景目录) |
| 不知道装什么、想按场景选型 | [场景目录](#-场景目录) |
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
| **验证报告** | 14 份可复现报告（插件 commit · mainline commit · 验证日期） | [reports/](#资源中心) |
| **报告 Schema** | 验证报告机器可读规范 v1（fullName 映射键 · verifiedBy · schemaVersion · security，市场/索引/CI 可消费） | [schema/report.schema.json](schema/report.schema.json) |
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

## 🧭 场景目录

> 更新于 2026-08-16 · 判定方法：[dsh-plugin-verify CLI](#插件作者投稿你的插件2-分钟上架)
>
> 判定站已验证插件与社区推荐候选的**统一选型目录**（基于 YELEBAI 2890 插件 / 0xsline 989 插件 / awesome 等生态数据建模，2026-08-16）。每行「状态」三态：**✅ 已验证**（通过 7/7 waterfall + tools/result 运行时复验，报告可复现）· **ⓘ 环境边界**（headless 判定环境缺其依赖服务，属判定方法边界而非插件缺陷，需 web profile 复验）· **候选**（尚未经判定站验证，标注 ⭐ 的为核查时点实测 Star 数，会随生态漂移）。完整状态语义见[状态体系](#-状态体系)。

**选型原则**：先装"管理基建"，再按你最痛的一两个场景补，别一次装很多。

### 🖥 界面与体验（UI & Experience）

*生态第一大场景：侧栏工作台、对话导航、UI 渲染、输入增强——用得顺手*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) | ⓘ | 服务化侧栏框架：右侧栏+底部面板双工作台（文件/编辑预览/内嵌浏览器/真实终端/Git/后台任务）；`ctx.betterSidebar` 服务开放给第三方插件注册 tab/viewer；只注册 `settings.section`（未碰 single 槽） | 2026-08-15 复验 | — |
| [dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui) | ⓘ | 任务看板、Git 关系图、皮肤中心、桌面宠物、token 统计一站式合集（生态最高星 ⭐2.4k）；重度 web 前端包 | 2026-08-16 | — |
| [dsh-navbar](https://github.com/vlln/dsh-navbar) | ✅ | 对话节点导航条：右侧缘节点串快速跳转任意 user 消息节点（长对话不用滚屏） | 2026-08-16 | [view](reports/navbar-2026-08-16.json) |
| [dsh-at-file](https://github.com/omdsh-dev/dsh-at-file) | ✅ | Codex 风格 @path 引用：对话里 `@路径` 解析为文件上下文（agent/pre-step 瀑布注入），客户端注入 ui-input-trigger/ui-slots | 2026-08-15 | [view](reports/at-file-2026-08-15.json) |
| [dsh-genui](https://github.com/omdsh-dev/dsh-genui) | ✅ | ```dsh-ui fence 生成 UI：模型用 DSL 声明界面，client 渲染器 + settings.section 注册 | 2026-08-15 | [view](reports/genui-2026-08-15.json) |

### 👁 视觉（Vision）

*让纯文本模型"看得见"：图片问答、OCR、UI 还原——生态第二梯队热点（modlens 2208★）*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [ModLens](https://github.com/liustack/modlens) | ✅ | 首个 DSH 视觉插件：聊天直接粘贴图片 → 文本模型获得视觉（image→文本引擎），注入 tools/agents/attachments/llm（入口走 package.json `exports` 而非 `main`，实测加载正常） | 2026-08-15 | [view](reports/modlens-2026-08-15.json) |
| [dsh-vision-toolkit](https://github.com/Anionex/dsh-vision-toolkit) | 候选（⭐405） | 图片问答、长截图 OCR、UI 还原、像素对比，适合前端/视觉任务 | — | — |

### 🔍 搜索与联网（Search & Web）

*搜得到：网页搜索、抓取、带引用证据——与视觉组成"看+搜"组合*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [modsearch](https://github.com/liustack/modsearch) | ✅ | 搜索网页和 X，返回带引用的结构化证据；注入 tools/web（与 ModLens 组成"看+搜"组合） | 2026-08-16 | [view](reports/modsearch-2026-08-16.json) |
| [anweat/dsh-web-search-pro](https://github.com/anweat/dsh-web-search-pro) | 候选 | 多引擎+缓存的搜索后端增强 | — | — |
| [TonyDua/dsh-web-search-exa](https://github.com/TonyDua/dsh-web-search-exa) | 候选 | 零配置 Exa 搜索后端 | — | — |

### 💻 编码与开发（Coding & Dev）

*git 集成、代码审查、CLI 适配、测试——写代码的帮手（生态最大类）*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [dsh-repo-context](https://github.com/qing3a/dsh-repo-context) | ✅ | 把 git 状态与仓库规范动态注入 system prompt（section/context/variable，官方缝隙插件） | 2026-08-14 | [view](reports/repo-context-2026-08-14.json) |
| [falsify-dsh](https://github.com/shi275773124/falsify-dsh) | ✅ | Falsify CLI 适配器：裁决收据（lint / review --json / gate） | 2026-08-14 | [view](reports/falsify-2026-08-14.json) |

### ⚙️ 自动化（Automation）

*事件驱动唤醒、定时循环、断线续跑——把人工盯守交给机器*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [dsh-sentinel](https://github.com/fuhefei/dsh-sentinel) | ✅ | 事件驱动唤醒：文件/命令/HTTP/进程/Webhook 触发（v0.10.0，按判定站建议修复 webServer 必选注入 + heartbeat unref；修复后作者即用 dsh-plugin-verify 复测通过，判定站独立复验一致） | 2026-08-16 | [view](reports/sentinel-2026-08-16.json) |
| [dsh-automation](https://github.com/titanwings/dsh-automation) | ⓘ | 定时/自动化任务调度：cron 触发、并发限制、人工审批门、历史回放；`automationDomainSpec` 数据域（依赖 zod/luxon，非 zero-dep） | 2026-08-15 复验 | — |
| [dsh-loop](https://github.com/vlln/dsh-loop) | 候选 | `/loop` 定时循环 | — | — |
| [dsh-auto-continue](https://github.com/HsiangNianian/dsh-auto-continue) | 候选 | 网络波动/超时导致回合失败后自动发"继续"续跑，无人值守必备 | — | — |

### 💾 记忆与上下文（Memory & Context）

*长期记忆、记忆主权、上下文优化——跨会话经验累积*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [dsh-memory-evolve](https://github.com/csyangwen/dsh-memory-evolve) | ✅ | 纯插件五轨长期记忆 + 技能自进化，零核心修改、卸载即净（注入 tools/systemPrompt/agents/settings 等 8 服务，headless 全激活） | 2026-08-16 | [view](reports/memory-evolve-2026-08-16.json) |
| [dsh-mneme](https://github.com/modusensus/dsh-mneme) | 候选 | SQLite + 可人工编辑的 Markdown 镜像，记忆透明可改（"记忆主权"派） | — | — |

### 🛠 调试与诊断（Debug & Diagnostics）

*事件审计、会话诊断——让插件作者/开发者看清 harness 内部发生了什么*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [dsh-event-auditor](https://github.com/qing3a/dsh-event-auditor) | ✅ | harness 事件流审计面板：事件类型/分发模式/计数；settings 热改 + /audit 命令 + headless dump | 2026-08-14 | [view](reports/event-auditor-2026-08-14.json) |

### 🔔 通知与提醒（Notification & Reminder）

*回合完成通知、任务进度、系统托盘——长任务不用盯屏*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [dsh-notification](https://github.com/omdsh-dev/dsh-notification) | ✅ | 回合完成桌面通知：成功/失败/关键词过滤，长任务不用盯屏 | 2026-08-16 | [view](reports/notification-2026-08-16.json) |
| [dsh-task-status](https://github.com/vlln/dsh-task-status) | ⓘ | 后台任务进度 + 实时输出 tail 显示在对话页，构建/下载/测试时不用干瞪眼；必选注入 `webServer`，headless 未激活 | 2026-08-16 | — |
| [dsh-tray](https://github.com/qing3a/dsh-tray) | ✅ | Windows 系统托盘（trayicon exe 宿主，无 native 编译）：菜单/通知/headless 降级 | 2026-08-14 | [view](reports/tray-2026-08-14.json) |

### 💰 成本与用量（Cost & Usage）

*Token 消耗、账户余额、预算——成本与资源可见性*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [dsh-balance](https://github.com/TwotwoPiggy/dsh-balance) | ✅ | Web 聊天框实时 Token 消耗估算 + DeepSeek 账户余额（纯 JS，ctx.inject 动态注入） | 2026-08-14 | [view](reports/balance-2026-08-14.json) |

### 🔒 安全与权限（Security & Permissions）

*密钥扫描、权限规则、恶意模式检测——装第三方插件前建议先有*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [dsh-security-scan](https://github.com/ben7am1n/dsh-security-scan) | ✅ | Secret & dangerous-pattern scanner（zero deps） | 2026-08-14 | [view](reports/security-scan-2026-08-14.json) |
| [dsh-plugin-vetting](https://github.com/truelove-dreamer/dsh-plugin-vetting) | 候选 | 装插件前静态扫描恶意模式（外传/凭据/混淆），覆盖供应链检查 | — | — |
| [dsh-mcpguard](https://github.com/ChenLaoshiYF/dsh-mcpguard) | 候选 | 扫描 skill 与 MCP 配置中的提示注入、同形字、危险 shell | — | — |
| [dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules) | 候选 | Claude Code 风格声明式权限规则（allow/deny/ask） | — | — |

### 🏗 管理基建（Infrastructure）

*插件市场、管理入口、备份——插件多了之后的底座*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [dsh-hub-panel](https://github.com/jiangxingfan1-coder/dsh-hub-panel) | ✅ | Settings 页插件商店 UI（dual-face，client slot 注册 + fetch 行为）——首个通过运行时验证的双面插件（v0.1.0） | 2026-08-16 | [view](reports/hub-panel-2026-08-16.json) |
| [dsh-id](https://github.com/jiangxingfan1-coder/dsh-id) | ✅ | 个人身份同步层（host 常驻：patch + 定时器 + 工具注册，v0.7.0） | 2026-08-16 | [view](reports/dsh-id-2026-08-16.json) |
| [dsh-market](https://github.com/dsh-market/dsh-market) | 候选 | 官方社区推荐的插件市场：设置页内浏览/搜索/分类筛选/一键安装，已装插件一目了然 | — | — |
| [plugin-registry](https://github.com/vlln/plugin-registry) | 候选 | 可视化插件管理入口 + `make-dsh-plugin` 开发引导，新手首选 | — | — |
| [dsh-backup](https://github.com/xiaoyuyu6420/dsh-backup) | 候选 | 一键备份/恢复 DSH 用户数据，定时自动备份，装插件多了之后是救命稻草 | — | — |

### 🌐 远程与访问（Remote & Access）

*局域网访问、反向代理、远程控制——生态热点（149 插件），待收录*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| *待收录* | — | 生态已有 dsh-lan-access / dsh-full-remote / dsh-web-access 等热点插件，验证后收录于此 | — | — |

### ⌨️ 终端与 TUI（Terminal & TUI）

*终端界面、命令行增强——高星集中（dsh-TUI 1441★），待收录*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| *待收录* | — | 生态已有 dsh-TUI / dsh-bash-terminal 等热点插件，验证后收录于此 | — | — |

### 🧠 模型与编排（Models & Orchestration）

*子代理委派、模型切换/回退、桥接——让模型编排更灵活*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [dsh-subagent-max](https://github.com/aaravarr/dsh-subagent-max) | ✅ | 双面插件：`subagent_with_model` 工具（每次调用可指定子代理的 model/provider）+ 多面板实时子代理查看器（host 面已验证，client 面 web UI 不在 headless 判定范围） | 2026-08-17 | [view](reports/subagent-max-2026-08-17.json) |
| [dsh-llm-fallbacks](https://github.com/omdsh-dev/dsh-llm-fallbacks) | ✅ | 基于角色的模型重试与备用策略：LLM 请求持续失败（重试耗尽/鉴权/配额/限流）时自动走 provider/model 回退链（v0.2.1，纯挂载 + 自带 gateway） | 2026-08-17 | [view](reports/llm-fallbacks-2026-08-17.json) |

### 📦 导入与迁移（Import & Migration）

*从 Claude Code/Codex/ChatGPT 等迁移会话——硬需求，待收录*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| *待收录* | — | 生态已有 dsh-claude-move / dsh-chat-import（13 源全保真导入）等，验证后收录于此 | — | — |

### 🎮 乐子与皮肤（Fun & Themes）

*桌面宠物、摸鱼游戏、皮肤美化——按需*

| 插件 | 状态 | 说明 | 验证日期 | 报告 |
|---|---|---|---|---|
| [whale-girl](https://github.com/vlln/whale-girl) | 候选 | 桌面宠物 | — | — |
| [dsh-minigames](https://github.com/lhh010/dsh-minigames) | 候选 | 18 款摸鱼小游戏 | — | — |
| [dsh-MusicPlayer](https://github.com/xiekai886/dsh-MusicPlayer) | 候选 | 网易云音乐播放器 | — | — |

> **选型建议**：不用一次装很多。从 **[dsh-market](https://github.com/dsh-market/dsh-market) + [dsh-backup](https://github.com/xiaoyuyu6420/dsh-backup)** 起步，再加你当前最痛的一两个场景（纯文本模型就上 modlens+modsearch；总盯着长任务就上 dsh-task-status+dsh-notification），用几天再扩。

> ⚠️ **注意**：候选 = 未经判定站验证。这些全是第三方插件，会在你机器上运行代码。装之前看一眼仓库的源码、许可证和最近更新情况，优先装 Star 高、活跃维护的。安装方式一般是 `dsh plugin add <GitHub 仓库>` 或在市场里一键安装。**推荐 ≠ 判定站 Verified**——想让场景目录里哪个插件拿到 ✅ 徽标，走[投稿流程](#插件作者投稿你的插件2-分钟上架)，判定站免费帮你跑一遍运行时验证。

> **收录批次**：2026-08-16 第三批次（2 个，全部 ✅）：dsh-hub-panel（dual-face 双面插件，v0.1.0）· dsh-id（host 常驻，v0.7.0）——dsh-hub-index（jiangxingfan1-coder）试点验证对象，报告已可作其 verified 晋级证据。2026-08-16 第二批次（4 个候选）：dsh-memory-evolve ✅ + modsearch ✅（均 7/7 waterfall 通过，报告已附）；dsh-task-status ⓘ + dsh-web-ui ⓘ（依赖 web 环境服务，headless 无法激活——task-status 必选注入 `webServer`，web-ui 为重度 web 前端包，均属判定方法边界，非插件缺陷）。2026-08-16 收录批次（3 个，全部 ✅）：dsh-sentinel（v0.10.0）· dsh-navbar（v0.3.0）· dsh-notification（v0.1.1）——sentinel 的修复正是判定站 #4 建议的产物（webServer 移出必选 inject + heartbeat unref），形成"验证 → 作者采纳 → 生态受益"完整闭环。2026-08-15 收录批次（5 个）：at-file/genui/modlens 通过升级 ✅，automation/better-sidebar 标 ⓘ（依赖 web 环境服务，headless 判定模式无法激活，需浏览器级验证通道，非插件缺陷）。

> 你的插件还没在？[拿徽标只要 2 分钟](#插件作者投稿你的插件2-分钟上架)。

---

## 🔬 判定规则（透明公开）

**为什么是运行时判定**：静态检查只能证明"能加载"，证明不了"不破坏行为"。waterfall 监听器漏调 `next()` 会静默吞掉 agent 的默认行为——这类 bug 只有真实循环才暴露。

**判定流程**（mock-llm 触发完整 agent 循环，`tool_call_success` → 平台 shell 工具调用——Windows 用 `pwsh`、非 Windows 用 `bash`，见 `docs/runtime-validation.md` 平台边界）：

```
system-prompt/assemble → agent/pre-step → agent/request → llm/stream
→ tools/pre-execute → tools/execute → tools/post-execute → tools/result
```

**通过标准**：7/7 waterfall 链完整 + `tools/result` 收尾（零副作用）+ **R3**（目标工具真实执行成功——`tools/result` 载荷 `isError:false`；目标工具本身 `UNKNOWN_TOOL` 判失败，postmortem 0002 教训）。**R4**（功能冒烟，附加证据）——mock 触发的工具参数真实到达执行层，证明"能装且能用"而非仅"能加载"；R4 不并入总 pass（兼容工具未触发的合法场景），通过时报告标注。

**报告怎么读**（`verify-report.json`）：

```json
{ "pass": true, "waterfallFound": [7/7 事件], "waterfallMissing": [],
  "rules": [{"name":"R1-entry-shape","pass":true,...},{"name":"R2-patch-yaml","pass":true,...},{"name":"R3-tools-result","pass":true,...},{"name":"R4-function-smoke","pass":true,...}],
  "detail": "捕获事件: 13 | tools/result: 是" }
```

- `pass: true` + `missing: []` + `rules[]` 全 `pass` = ✅ 通过
- `missing` 列出哪段链没出现 → 定位插件哪个 waterfall 监听器有问题
- `rules[]`：R1（入口形态，postmortem 0001 unwrapExports 陷阱）、R2（`!!js` 只在 config 子树，postmortem 0002）、R3（`UNKNOWN_TOOL` 运行时判失败，postmortem 0002 快照教训）、R4（工具参数到达断言，功能冒烟）——静态规则是确定性信号，最终以运行时判定为准
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
| dsh-sentinel | [reports/sentinel-2026-08-16.json](reports/sentinel-2026-08-16.json) | ✅ |
| dsh-navbar | [reports/navbar-2026-08-16.json](reports/navbar-2026-08-16.json) | ✅ |
| dsh-notification | [reports/notification-2026-08-16.json](reports/notification-2026-08-16.json) | ✅ |
| modsearch | [reports/modsearch-2026-08-16.json](reports/modsearch-2026-08-16.json) | ✅ |
| dsh-memory-evolve | [reports/memory-evolve-2026-08-16.json](reports/memory-evolve-2026-08-16.json) | ✅ |
| dsh-hub-panel | [reports/hub-panel-2026-08-16.json](reports/hub-panel-2026-08-16.json) | ✅ |
| dsh-id | [reports/dsh-id-2026-08-16.json](reports/dsh-id-2026-08-16.json) | ✅ |
| dsh-subagent-max | [reports/subagent-max-2026-08-17.json](reports/subagent-max-2026-08-17.json) | ✅ |
| dsh-llm-fallbacks | [reports/llm-fallbacks-2026-08-17.json](reports/llm-fallbacks-2026-08-17.json) | ✅ |

> 报告均为 2026-08-14 用修正后 CLI（rules[] + R3）绝对路径重验版本，非早期空转版本；2026-08-16 七份（sentinel/navbar/notification/modsearch/memory-evolve/hub-panel/dsh-id）为当日独立复验。

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

### 开放数据层（verified.json）

判定站验证结果以开放数据层对外提供，任何插件市场/清单可直接引用：

- **[verified.json](verified.json)** — 全部 ✅ Verified 插件的运行时证据聚合（`verifiedBy` / `verifiedAt` / `reportUrl` / `waterfall` / `toolsResult` / `security`）
- **生成脚本**：[scripts/generate-verified.mjs](scripts/generate-verified.mjs) — 从 reports/ 聚合，验证一次跑一次
- **引用方式**：市场在 registry 条目加可选 `runtime` 字段（示例见 [YELEBAI 互操作提案](https://github.com/YELEBAI/dsh-plugin-marketplace/issues/5)）

---

## 🛡 生态安全层（Security Dimension）

验证不只测"行为正确"，还跑静态安全规则并随报告公开：

- **P202**（裸 `child_process.spawn`）——不经 `ctx.subprocess` 的子进程逃逸 host-exit 同步回收
- **P401**（single 槽注册）——第三方 priority 恒低，注册即 shadow 官方 UI 并破坏其子槽声明

结果聚合进 `verified.json` 的 `security` 字段（`clean` / `warnings` / `未评估`）。**自动批准类插件是生态定时炸弹**——判定站的「运行时验证 + 静态安全规则」双重防线，让"可信"从口号变成可复现的证据。

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
- **提 PR**：按提交包模板在 `submissions/<owner>/<plugin>/` 建三个文件（manifest + self_check + verify-report），自检 gate 通过后提 PR（只改自己的 `submissions/` 路径，场景目录与主页收录由维护者复核时同步）
- **提 Issue**：附上 `verify-report.json` 链接，说明插件名/仓库/分类/一句话描述

**为什么要投稿**：
- 在 288+ 个插件的"待测/未知"海洋里，✅ 徽标让你**脱颖而出**
- 验证会**帮你发现真实 bug**（[dsh-sentinel 案例](https://github.com/fuhefei/dsh-sentinel/issues/4)：headless 加载失败被验证工具抓出）
- 报告可直接作为 [awesome-dsh-plugins](https://github.com/AdamPlatin123/awesome-dsh-plugins) 登记 PR 的运行实测证据（其 L4 层）
- 收录进场景目录 → 用户/AI 按场景找你 → 被安装
- **双目录曝光**：验证通过的插件已被 [bradeGithub/DSH-Plugins-Marketplace](https://github.com/bradeGithub/DSH-Plugins-Marketplace) 等对接 `verified.json` 开放数据层的市场自动盖上「已验证」徽章（2026-08-16 已对接）

**收录条件**：公开仓库 + `dsh-plugin` topic + 合法 package.json + 运行时依赖声明 + 许可证 + README（含安装/卸载/最小示例）。命名用你有权控制的 scope，不占 `@deepseek-ai/*` 保留命名空间。

---

## 🛡 使用者：如何安全安装

1. 从[场景目录](#-场景目录)选 ✅ Verified 插件
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

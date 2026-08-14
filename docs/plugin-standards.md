# DSH 插件开发与设计规范建议 v0.1

> **性质**：**非官方**。本文是**基于官方源码行为分析与官方风格**提炼的开发约定建议，
> 目标是**让后来者不重复试错**——每条建议都标注了源码/官方文档依据与踩坑记录，
> 不是任何个人的喜好。
> **定位**：官方已有插件教程（`develop/basic/`：第一个插件 / 开发 Tool / 配置 / 打包安装 /
> 事件与服务），但官方**尚未发布面向生态的规范/约定**。本文只定义教程不覆盖的部分：
> 入口与配置红线（postmortem 教训）、生命周期与注入纪律、交互惯例、验证与投稿门槛、发布约定。
> **分工**：教程教"怎么开始"，本文定"避免踩坑的门槛"。先教程后本文（第 9 章给学习路径）。
> **依据分级**：每章标注 🔍 **源码依据**（可查证的官方行为，含文件路径）与 ⚠️ **踩坑记录**
> （实测真坑，标注"实测"）——没有源码/踩坑支撑的条目一律不写。

---

## 1. 总则

1. **插件是 cordis 插件**：`apply(ctx, config)` 是唯一入口契约；DSH 通过 loader 把
   `cordis.patch.yml` 的 insert 注入 profile，本质是 cordis 的 Plugin/Package
   （🔍 `docs/cordis-primer.md`、`docs/user/develop/basic/`）。
2. **先读实际运行版本再写代码**（⚠️ 实测）：npm rc 版与 master 源码存在 API 漂移
   （如 `ctx.webServer`=master vs `ctx.httpServer`=rc）。以实际安装版 `lib/types/` 为准；
   跨版本接口用鸭子类型最小接口解耦（官方 `defensive-patterns.md`「Honor public contracts
   on BOTH sides」同思路）。
3. **只观察，不破坏**：插件是 guest；waterfall 监听器漏调 `next()` 会静默吞掉 agent 默认
   行为——判定站存在的原因（第 7 章）。
4. **版本**：本文 v0.1（2026-08-14），随判定站演进。

---

## 2. 插件形态与入口

### 2.1 包结构

```
plugin/
├── package.json          # name/type/main/dsh.bundle.patch/files
├── cordis.patch.yml      # dsh.bundle.patch 指向（insert 声明）
├── tsconfig.json
└── src/index.ts          # 编译到 lib/
```

`package.json` 必需字段（🔍 `docs/user/develop/basic/publish.md`：bundle manifest vs profile
manifest 两套概念）：

```jsonc
{
  "name": "@scope/dsh-xxx",      // 小写 npm 包名
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "files": ["lib", "cordis.patch.yml"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

### 2.2 入口约定（红线，判定站 R1）

- 用 **namespace 形式**：`export const name` / `export const inject` / `export const Config` /
  `export function apply`（🔍 官方包全部如此，如 `packages/core/system-prompt/src/index.ts`、
  `packages/bundle/headless/src/index.ts`）。
- **禁止裸 `export default apply`**：
  - 🔍 loader 的 `unwrapExports`：`exports = exports.default ?? exports`——有 default 时
    优先取 default，namespace 兄弟导出（inject/name/Config）被丢弃。
  - ⚠️ **踩坑（官方 postmortem 0001，实测）**：ACP 插件 `export default apply` →
    `inject` 丢失 → 加载期崩溃 `cannot get property "agents" without inject`。
  - 若确需 `export default`，default 对象必须自身带 `name/inject/Config/apply`。

```ts
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

export const name = 'dsh-xxx'
export const inject: string[] = []        // 必选服务静态声明；可选服务用 ctx.inject（§4.2）
export interface Config { enabled: boolean }
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
})
export function apply(ctx: Context, config?: Config): void { /* ... */ }
```

### 2.3 ESM 纪律

- 源码 import 带 `.js` 后缀（`import { X } from './x.js'`）——🔍 官方包源码统一此风格。
- `@deepseek-ai/cordis` 只放 `devDependencies`（仅类型）；运行时依赖全走 `dependencies`。

---

## 3. 配置约定（红线，判定站 R2）

1. **schemastery**：默认导入 `z from '@deepseek-ai/schemastery'`；**没有 `.optional()`**，
   可选字段用 `.default('')`（⚠️ 实测，官方 schemastery 用法；见官方各 `Config` 定义）。
2. **`!!js` 只在 `config` 子树**（红线，⚠️ 实测）：
   - 🔍 loader 只插值 `Entry._resolveConfig()`（`entry.options.config`）；`Entry.disabled`
     直接测 `entry.options.disabled`，**不插值**。
   - ⚠️ **踩坑（官方 postmortem 0002）**：entry metadata（`disabled` 等）放表达式对象 =
     truthy 对象 → 条件配置被**静默**启用/禁用（YAML tag 合法，无任何诊断）。
3. **条件启用用 config 字段 + overlay**，不用 `disabled: !!js ...`（官方 guardrail 同款）。
4. **工具注册做语义断言**：`tools/result` 出现 `UNKNOWN_TOOL` 必须判失败
   （🔍 `packages/core/tools/src/index.ts:494` `ToolNotFoundError extends HarnessError
   (code: 'UNKNOWN_TOOL')`；⚠️ postmortem 0002：快照刷新把 UNKNOWN_TOOL 当新期望输出提交，
   语义断言才能拦住）。判定站 **R3**。

---

## 4. 生命周期与资源

### 4.1 资源释放（🔍 官方 `defensive-patterns.md`「Dispose must reach quiescence」）

- 所有监听/定时器/子进程用 `ctx.effect` 包裹，插件卸载自动清理（🔍 官方教程「自动清理」
  一节：`ctx` 注册的资源随卸载自动清理）。
- `dispose` 必须 **async 且 await 子进程退出**（kill → await done），不留孤儿；先关
  listener 注册表再 kill，迟到的完成保持静默（⚠️ 实测：trayicon spawn EBUSY / start 竞态双托盘）。

### 4.2 服务注入（⚠️ 实测 + 🔍 源码）

- **必选服务**：进 `inject` 数组 → profile 缺该服务时加载失败（硬依赖）。
- **可选服务**（如 `webServer`）：用 `ctx.inject(['webServer'], cb)` **动态注入**：
  - ⚠️ 不是 `inject` 数组（会阻塞无该服务的 profile——headless 下 pending 阻塞整个加载树，
    已实测，并在 fuhefei/dsh-sentinel#4 中给外部插件作者复现过）；
  - ⚠️ 不是 `ctx.get` 直接读（未注入会抛错）。

```ts
export const inject: string[] = []   // webServer 不进这里
export function apply(ctx: Context): void {
  ctx.inject(['webServer'], (webServer) => {
    webServer.register('/audit', handler)   // 有 webServer 才挂
  })
}
```

- **不在 `inject` 的服务用 `ctx.get(name)`**：
  - 🔍 `ctx.<name>` 属性走 ancestor-only fiber walk（fiber 拓扑向上找），经 foreign shadow
    的 traceable proxy 会失败到 root 抛错（postmortem 0001 Bug#2）；`ctx.get()` 走
    isolate-keyed global store，无拓扑依赖。
  - ⚠️ 官方 postmortem 0001：`AgentLoop.resume` 原用 `this.ctx.sessionPersistence` 踩此坑，
    修复改为 `this.ctx.get('sessionPersistence')`。

---

## 5. 事件纪律

1. **waterfall 监听器必须调 `next()` 并透传返回值**（红线）：
   - 🔍 各 waterfall 事件签名已逐条从源码确认（2026-08-14）：`system-prompt/assemble
     (assembly, context, next)`、`tools/pre-execute(exec, next)`、`tools/execute(exec, next)`、
     `tools/post-execute(exec, result, next)`、`agent/request(payload, next)` 等，**next 均无参**。
   - ⚠️ 漏调 next = 静默吞掉 agent 默认行为——判定站 7/7 链的验证目标。
2. **emit 观察零副作用**：`ctx.on` 监听不进修改路径；审计/观测类插件用万能观察者
   `(...args) => void`，不声明事件参数类型（对齐 dsh-event-auditor 做法）。
3. **核心 waterfall 链**（判定站 7/7 标准，🔍 官方事件分发，见 `docs/cordis-api/events.md`）：

```
system-prompt/assemble → agent/pre-step → agent/request → llm/stream
→ tools/pre-execute → tools/execute → tools/post-execute → tools/result
```

---

## 6. 交互逻辑（web 插件）

> 🔍 官方 seam 文档：`docs/subsystems/web-server.md`（路由/升级/fallback/tapIndex）、
> `docs/subsystems/system-prompt.md`、`docs/subsystems/commands.md`。以下惯例从
> dsh-event-auditor / dsh-tray / dsh-repo-context 三个已验证插件 + 官方用法提炼。

### 6.1 webServer 路由

- `ctx.webServer.register(path, handler)` 挂 HTTP 路由；`registerUpgrade` 挂 WebSocket；
  `registerFallback`（单席位）兜底；`tapIndex` 注入前端资源（🔍 web-server.md）。
- **headless 降级**：webServer 走 §4.2 动态注入，headless 无该服务不崩。

### 6.2 settings 集成（可选）

- `installSettingsSection` 挂设置分组；分组开关与事件监听组一一对应；同组事件热改时
  dispose 重建（⚠️ 实测：dsh-event-auditor v0.3 settings 热改）。

### 6.3 commands（斜杠命令）

- `ctx.commands` 注册 `/xxx` 会话命令，handler 直接执行（不经模型）。跨 rc/master 漂移
  用鸭子类型 `CommandsRegistrar` 解耦（⚠️ 实测）。

### 6.4 client 平台（dsh.client，可选）

- web 插件浏览器侧需 `dsh.client` 平台声明 + client 构建链
  （`build:lib:host` + `build:lib:client` + web-frontend dist 三层，缺一不可，⚠️ 实测）。

### 6.5 system-prompt 注入（可选，🔍 `docs/subsystems/system-prompt.md`）

- `ctx.systemPrompt.section()/context()/variable()` 动态装配；返回 exact disposer。
- **text/variable provider 是同步签名**（🔍 `PromptSection.text: (context) => string`）：
  不能 await，需预取缓存（⚠️ 实测：异步获取需启动时缓存 + 定时刷新）。
- **变量名须匹配 `^[a-z][a-z0-9_]*$`**（🔍 `packages/core/system-prompt/src/index.ts:448`，
  非法名直接 throw，⚠️ 实测：`gitBranch` 大写被拒 → 用 `git_branch`）。
- **同层重名抛错**：命名加 `repo:`/`xxx:` 前缀（🔍 system-prompt.md 重名语义）。
- `context` 适合动态快照（user-role durable，变化才记录，不破坏前缀 KV cache），
  `section` 适合静态指引，`variable` 渲染时无值会抛错（🔍 system-prompt.md）。

---

## 7. 验证标准（判定站门槛）

> 判定站 = dsh-plugin-verify。投稿 = 通过判定 + 声明符合本文。每条规则都有官方依据
> （第 2/3/5 章），不是判定站自设标准。

| 层 | 检查 | 工具/来源 | 依据 |
|---|---|---|---|
| 静态 | **R1** 入口形态（无裸 export default） | `scripts/static-rules.mjs` | postmortem 0001（§2.2） |
| 静态 | **R2** patch YAML（`!!js` 只在 config 子树） | 同上 | postmortem 0002（§3.2） |
| 运行时 | **7/7 waterfall 链完整 + `tools/result` 收尾** | mock-llm + headless + verify-auditor | Discussion 462 方法论（§5.3） |
| 运行时 | **R3** `tools/result` 无 `UNKNOWN_TOOL` | 同上 | postmortem 0002 快照教训（§3.4） |
| 人工 | defensive-patterns 7 条评审 | `docs/review-checklist.md` | 官方 `docs/defensive-patterns.md` |

**判定 ≠ 官方背书**：基于当日 mainline、证据可复现；报告含插件 commit / mainline commit /
验证日期 / 报告链接（缺一项即降低信任等级）。

---

## 8. 发布与分发

1. **npm**：`@scope/dsh-xxx`，`files` 含 `lib` + `cordis.patch.yml`；版本语义化；
   `keywords` 带 `dsh`/`deepseek-harness`/`dsh-plugin`（生态雷达/市场的发现通道）。
2. **GitHub**：打 `dsh-plugin` topic；`repository` 字段指向仓库；README 写明安装命令与
   安全提示（"安装授予进程级权限"）。
3. **cordis.patch.yml**：`insert: [{ id, name }]` 声明；patch 必须是仓库内安全相对路径
   （🔍 `docs/user/develop/basic/publish.md`「Installing from GitHub: the build-script catch」）。

---

## 9. 学习路径与参考

> **先教程后规范**：官方教程教怎么写（How），本文定"避免踩坑"的门槛（What to do / Not to do）。

**官方教程（deepseek-harness.github.io/deepseek-harness/develop/）**：
- `basic/`：第一个插件 / 开发一个 Tool / 插件配置 / 打包与安装插件
- `framework/`：插件与生命周期 / 服务与依赖 / 事件系统
- `practice/`：能力的三层拆分 / LLM 适配器
- cordis-tutorial：总览 / 生命周期与副作用 / 服务 / 事件 / 配置 / 组合与热重载 / 进入 Harness

**官方深度文档（deepseek-harness 仓库 docs/）**：
- `docs/cordis-primer.md`：loader 配置（`!!js` 只插值 config、overlay）
- `docs/subsystems/*`：各能力 seam（system-prompt / web-server / approval / schedule / …）
- `docs/cookbook/extension-cookbook.md`：插件形态参考模式
- `docs/postmortem/0001/0002`：入口 export default 陷阱 / `!!js` 静默禁用
- `docs/defensive-patterns.md`：官方代码防御纪律（§4-6 的底层依据）

**范例插件（qing3a，本文建议的实证来源）**：dsh-event-auditor / dsh-tray / dsh-repo-context
**判定站**：`dsh-plugin-verify`（CLI + Verified 目录 + 投稿系统）

---

## 10. 依据索引（建议 → 源码/官方文档可查证）

> 本文每条的"凭什么"都能在这里查证——**没有任何一条是拍脑袋定的**。

| # | 建议 | 🔍 源码/官方文档 | ⚠️ 踩坑 |
|---|---|---|---|
| 2.2 | namespace 入口，禁裸 export default | loader `unwrapExports`（`exports.default ?? exports`）；官方包统一 namespace | postmortem 0001（ACP inject 丢失崩溃，实测） |
| 2.2 | 不在 inject 的服务用 ctx.get | fiber ancestor-only walk（reflect.ts get handler） | postmortem 0001 Bug#2（AgentLoop.resume 实测） |
| 3.2 | `!!js` 只在 config 子树 | `Entry._resolveConfig()` 插值 config；`Entry.disabled` 不插值 | postmortem 0002（fs 工具永久禁用，官方快照全绿仍掩盖） |
| 3.4 | UNKNOWN_TOOL 判失败 | `packages/core/tools/src/index.ts:494` `ToolNotFoundError(code)` | postmortem 0002（快照刷新提交 UNKNOWN_TOOL） |
| 4.2 | 可选服务用 ctx.inject 动态注入 | ctx.inject 可选注入语义 | headless pending 阻塞加载树（实测；sentinel#4 复现） |
| 5.1 | waterfall 必须透传 next() | 各 waterfall 签名逐条源码确认，next 无参 | 漏调 = 吞 agent 默认行为（判定站 7/7 目标） |
| 6.5 | variable 名 `^[a-z][a-z0-9_]*$` | `packages/core/system-prompt/src/index.ts:448` | `gitBranch` 大写直接 throw（实测） |
| 6.5 | provider 同步签名 | `PromptSection.text: (context) => string` | 异步 await 不可行，需预取缓存（实测） |
| 4.1 | dispose await 子进程退出 | 官方 `defensive-patterns.md`（Dispose must reach quiescence） | trayicon EBUSY / 双托盘竞态（实测） |
| 6.1-6.4 | 交互惯例（webServer/settings/commands/client） | 官方 `docs/subsystems/*` seam 文档 | 三层构建链、动态注入、鸭子类型解耦（实测） |

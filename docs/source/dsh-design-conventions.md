# DeepSeek Harness（dsh）设计规范整理

> 本文档整理自 2026-08-14/15 会话中对官方仓库 `~/Desktop/ds/deepseek-harness`（`@deepseek-ai/dsh-root` v0.1.0-rc.5）的探索。每条规范给出依据路径；引用路径均相对官方仓库根。可作为插件开发 / 参与贡献 / Rust 化评估的设计基线。

---

## 1. 插件系统规范（Cordis）

**插件 = 进程内动态 import 的 JS 模块**，无独立进程形态、无 start/stop 钩子，采用 effect/disposer 清理模型。插件实例是纯内存对象，随宿主进程同生共死。

- 三种插件形态：`Plugin.Function`（`(ctx, config) => any`）/ `Plugin.Constructor`（类）/ `Plugin.Object`（`{ apply(ctx, config) }`）。`vendor/cordis/src/registry.ts`
- 加载：`ctx.plugin(plugin, ...config)` 创建 `Fiber`（运行时实例），`FiberState`: `PENDING / LOADING / ACTIVE / FAILED / UNLOADING / DISPOSED`。`vendor/cordis/src/fiber.ts`
- 清理：插件体内用 `ctx.effect(executor, label?)` 注册 disposer，卸载时**逆序**执行。没有 ready/fork 生命周期。
- 依赖注入：元数据 `inject`（依赖的服务）与 `provide`（提供的服务）；`ctx.inject(deps, cb)` 依赖就绪后执行。
- 配置校验：插件 `Config` 用 schemastery 表达式（`z.object(...)` / `z.intersect([...])`），必须是可静态遍历的形式，否则 gen-config-catalog 硬错。`scripts/gen-config-catalog.ts`
- 服务插件：`class X extends Service` + `super(ctx, 'key')` 注册 `ctx.key`，随所属 fiber 自动注销。`vendor/cordis/src/service.ts`
- 导出约定：**服务包 default-export 服务类；函数插件 named-export `name`/`inject`/`Config`/`apply` 且无 default export**（混用会被 Loader 丢弃）。`packages/AGENTS.md:5`
- 动态加载：异步（动态 `import()`），支持运行时 `ctx.loader.create/update/remove` 与 HMR 热重载。`vendor/loader`
- 进程生命周期：CLI 绑 `SIGTERM`/`SIGINT` → `createProcessShutdown` → `ctx.fiber.dispose()` → 逆序 disposer → 5 秒超时强杀。`apps/cli/src/process-shutdown.ts`
- 配置文件：cordis.yml 顶层是 entry 列表，每项 `- id: <plugin-id>`，可带 `disabled:` 与 `config:`；**只有 `config` 和 `disabled` 允许 `!!js`，其它元数据保持字面量**。`AGENTS.md:96`

## 2. 进程与执行规范

**无 daemon / 后台守护机制**：`dsh web` 是前台进程，关终端即死；`Loader.exit()` 是空实现（"Hook for hosts that can restart the process on full-reload"）。常驻/守护/崩溃重启**全部外包给进程外宿主**（这正是 dsh-desktop 的定位）。`apps/cli/README.md`、`vendor/loader/src/index.ts`

- 子进程统一经 `ctx.subprocess`（subprocess-local）：POSIX `detached: true` 仅为拿进程组根做树级信号，**不是**为持久化；Windows 用 `taskkill /T /F` 杀树。`packages/subprocess/subprocess-local/src/spawn.ts`
- **host exit 同步 SIGKILL 所有登记进程树**：`process.prependListener('exit', onHostExit)`，spawn 出去的子进程默认随父死亡被回收。唯一存活方式是 setsid/reparent 逃逸，官方明确当局限而非支持模式。`packages/subprocess/subprocess-local/README.md`
- 沙箱四后端：`bwrap | landlock | seatbelt | windows-acl`；探针用 `spawnSync` 一次性验证；**`confine` 必须返回 enforcing argv 或 fail-closed，静默的非受限透传被禁止**；`SandboxMode` 仅 `read-only / workspace-write / danger-full-access` 三种。`docs/subsystems/sandbox.md`
- 原生组件模式：`native/landlock-run` = 独立 C11 二进制 + 薄 TS 包装 + 平台分包 npm（`-linux-x64`/`-linux-arm64` prebuilt）+ CLI 契约（argv 语法、`--probe`、fail-closed 退出码 125）。**仓库内无 .rs 文件，唯一原生代码是 C11。**
- env 脱敏：`scrubbedParentEnv()` 按 `/KEY|PASSWORD|SECRET|TOKEN/i` 剔除凭证形变量 + 所有 `DSH_*`，保留 PATH/HOME/locale/proxy；刻意下发的凭证走 spec 显式 `env`（scrub 之后 merge）。`packages/subprocess/subprocess/src/index.ts`

## 3. MCP 规范

**dsh 只消费 MCP，不生产 MCP server**（`packages/mcp` 只有 mcp-client）。要把能力暴露给其它实例，需自建 MCP server 进程。

- 一个 server = 一个 mcp-client 插件实例；工具以 **`mcp__<serverName>__<rawName>`** 注册到 `ctx.tools`，`serverName` 全实例唯一、`[A-Za-z0-9_-]{1,32}`。`packages/mcp/mcp-client/README.md`
- 传输两种：`stdio`（子进程，env 脱敏后叠加）与 `streamable-http`（远程 URL，**认证上限是静态 headers**，如 `Authorization: Bearer ...`，无 OAuth 动态流程）。
- 重连：指数退避（默认 500ms 起、上限 30s、最多 10 次），支持 `tools/list_changed` 重同步。`packages/mcp/mcp-client/src/connection.ts`
- **只有 tools 被桥接**，Resources 与 Prompts 无消费者、被 defer。
- agent-to-agent 互操作的另一面：`packages/acp/acp` 是 **ACP server**（Automation-only，stdio JSON-RPC），可把 dsh agent 暴露给外部驱动。
- 配置示例（cordis.yml）：`transport: stdio`（`command/args/env`）或 `transport: streamable-http`（`url/headers/toolCallTimeoutMs/failOnStartupError/reconnect`）。`packages/mcp/mcp-client/README.md`

## 4. 数据与持久化规范

- **attachment 只存图片**（png/jpeg/webp/gif），内容寻址 `sha256:<digest>` 落 `<DSH_HOME>/attachments/v1/`；**不能用于简历 PDF/Word**。`packages/attachment/attachment`
- 简历/通用文件：放本地目录 → 注册为 workspace → agent 用 `ctx.fs`（`tool-fs` read/glob/grep，rg 二进制）解析。**没有"上传文件给 agent"的通用用户功能**，给文件的正道是选一个 workspace 目录。`docs/subsystems/filesystem.md`
- 插件自定义数据：**走 `ctx.storageDomain`**（`ctx.storage.domain`），`defineDomain(spec)` 声明 zod 记录 schema，由配置路由到 json 或 sqlite backend，写后发 `domain/changed` 事件。产品包不直接碰 backend。`docs/subsystems/storage.md`
- storage-sqlite：node:sqlite `DatabaseSync`，document-per-row STRICT 表（每行一个 JSON 文档，key TEXT PRIMARY KEY），WAL 默认；**单写自动原子，无多进程写保护、无迁移**。高频变更数据选 sqlite，可读低频选 json。`packages/storage/storage-sqlite/README.md`
- **`domain/changed` 是进程内事件，跨进程变更推送明确 deferred**——多实例同步官方不支持，需插件自建。`packages/storage/storage-domain/README.md`
- session 持久化：append-only 事件日志 + 崩溃尾部修复 + resume/load/`prepare`（保留未发布 Session 供恢复）；session 投影有磁盘 checkpoint（throttled write-behind + turn/end 强制点）。`packages/session/session-persistence/`、`docs/subsystems/session-projection.md`

## 5. UI 与前端规范（slot 系统）

**前端插件 = 服务端/构建期组合出的 client bundle**：插件包声明 `dsh.client` manifest，产物 `/plugins/<id>/client.js?rev=<rev>`，浏览器经 `__ModuleLoader__` 加载并执行 `apply`，再 `ctx.slots.register` 贡献 UI。

- 四种 slot 卡点：`single`（单 occupant）/ `list`（多个可排序）/ `keyed` / `chain`（按 selector 路由）。`packages/client/ui-slots/src/index.ts`
- **"声明即独占"**：`children` 子槽由注册方声明，第三方不能追加（同 key 二次声明直接抛错）；渲染哪些 key 写死在组件里。`packages/client/ui-slots/src/index.ts:787`
- **priority 规则"低者胜出"**：第三方插件 priority 自动递减（-1、-2…），严格低于 shipped 的默认 0——**插件一旦注册进 single 槽会顶掉官方 occupant（shadow 替换）**，且被 shadow 的 entry 的子槽声明仍占着账本。
- 对外贡献 UI：需 `inject: ['slots']`，用 `ctx.slots.inject(key, () => ctx.slots.register(...))` 等声明存在（注册进未声明槽会抛错）。`packages/client/AGENTS.md`
- 槽位清单是机器生成的：约 50 个槽（`conversation.chat.node`、`sidebar.footer.action`、`settings.section`、`shell.overlay` 等），带 `replaceRisk` 标注。`packages/extensions/cordis-client-runner/src/client/slot-catalog.ts`
- 侧栏（ui-sidebar/SidebarRoot）：渲染写死三块——`sidebar.workspaces`（single，WorkspaceBrowser 独占）/ `sidebar.footer.action`（list）/ `sidebar.settings`（single）。**列表上方没有 add-only 扩展点**；工作区 header 内无子槽（唯一子槽 `sidebar.workspaces.directoryFlow` 服务 Add 弹窗）。
- 三条 UI 扩展路径：槽注册（通用）、`conversation.chat.node`（聊天流内自定义节点，`ConversationNodeDefinition` + keyed renderer）、`settings.section` / `shell.overlay`（设置项/全屏遮罩）。`docs/cookbook/adding-a-conversation-node.zh.md`

## 6. 视觉与主题规范

- 主题系统：`packages/client/ui-theme/src/styles/` 5 张 sheet——`base.css`（字体栈/motion 曲线）、`design-platform.css`（色彩唯一权威）、`scrollbar.css`（`--dsw-alias-scrollbar-*` 独有消费者，必须后于 design-platform 加载）、`gradient-shadow-text.css`、`shiki.css`。
- **token 三层派生**：`--dsw-static-*`（裸色值约 279 个）→ `--dsw-alias-*`（语义 token 约 158 个）→ `--dsw-specific-*`（绑定具体 UI 位置，约 22 个，如 `--dsw-specific-sidebar-fill`）；逐层 `var()` 引用。CSS 标注来源为 Figma 插件导出。
- 深色模式：非色相变量在 `body` 声明一份、`body[data-ds-dark-theme]` 覆盖一份；`ThemePreference = 'light'|'dark'|'system'`，默认 `system`（浏览器 `prefers-color-scheme` 解析）。`packages/client/ui-theme/src/theme-settings.ts`
- 品牌元素：FishLogo / BrandWordmark（`packages/client/ui-primitives/`），文件头直接引用 Figma 节点号；`currentColor` 上色。
- 组件样式：**PascalCase 组件名 + `.module.css` 放组件旁**（CSS Modules）。`docs/web-styling.md:11`
- 字号由 `--dsw-font-*` 复合变量承载；radius/space 无专门 token 体系，由组件 CSS Modules 各自持有。

## 7. i18n / 文档规范

- locales：每个 feature 包 `src/client/locales.ts` 导出 `zh`（**键集权威源**）与 `en`（`satisfies Record<ThemeKey, string>` 强制键集完整）；`t()` 经 `locale` LocaleRuntime 字典注册表（查找链 ns→common→zh→key）。`packages/client/locale/README.md`
- 双语文档：每份英文 md 配 `.zh.md` + `.i18n.yaml`（记录两侧 git blob hash 作为"上次确认一致"状态）；`verify-translation-pairing` 比对当前 hash 与记录，生成文档不得存在 .zh.md。`README.i18n.yaml`
- docs/ 分层（docs/AGENTS.md）：`architecture.md`=组件地图、`subsystems/`=每子系统一页 reference、`cookbook/`=带编号验证步骤的 how-to、`user/`=面向产品用户发布到文档站、`cordis-tutorial/`=01-07 入门教程。
- **文档预算**：`verify-doc-budgets` 按词数上限逐文档检查，上限只能向下收紧（≥5% 余量），提高需 PR 说明理由。
- 格式铁律：`verify-md-wrap` 拒绝跨多行散文段落（每段一行）；`verify-md-links` 要求相对链接目标存在且 `#fragment` 命中真实标题 slug；`doc-typecheck` 编译 md 中所有 `ts` 代码块；`verify-export-jsdoc` 对每个非 vendored 包导出强制 JSDoc（参数/返回值/描述，未知形态 fail closed）。

## 8. 代码与工程规范

- 包命名：一律 `@deepseek-ai/dsh-<name>`（client 域 `@deepseek-ai/dsh-client-<name>`）；vendored 包 rescope 同前缀且 `private: true`；`@deepseek-ai/cordis` 是所有 harness 包的 peerDependency(+dev)。`AGENTS.md:100`
- 目录：`packages/<group>/<pkg>` 两级，group 是纯容器（无 package.json、无源码）；文件命名 kebab-case；固定文件 `src/index.ts`（入口）、`src/types.ts`（**只含类型无运行时代码**）、`src/invariant.ts`、`src/error.ts`；测试在包级 `tests/`（不在 `src/__tests__/`）。`packages/AGENTS.md:23`
- 角色命名：类/服务名从 Role 表选取（Controller/Store/Presenter/Registry/Runtime/Resolver/Binder/Engine/Policy/Executor/Gateway/Provider/Backend/Handle/Config/Service）；单数 ctx key=一个引擎/存储，复数=registry。`docs/cookbook/adding-a-package.md:41`
- package.json 不变量（`pnpm run constraints` 强制）：`private: true`、version 等于 root、`type: module`、`main: "lib/index.js"`、`types: "lib/types/index.d.ts"`、`files` 恰好含 `lib/index.js`/`lib/invariant.js`/`lib/types/**/*.d.ts`。
- 构建：tsc 先 emit `lib/types/`（declaration），tsdown 再 bundle 到 `lib/*.js`（ESM-only、`target: es2024`）；**host/client 是两个独立 aggregate program**（两侧对 cordis Context 接口做 declaration merging 会冲突），新包只能注册进其一。`docs/development.md:46`
- client 包：`dsh.client` manifest（`platform: 'web'` 恒为 web、`immediately: true` 仅 stage-one-prefetch 行、`inject` 信息性）、exports `./client`、共享 tsdown preset `clientBundle(id, [...])`；`src/index.ts` 是空 node-half apply。`packages/client/AGENTS.md:94`
- 错误处理：`src/error.ts` 定义 `extends Error` 的域错误，**`code` 是稳定契约（可 switch），`message` 是诊断 prose**（绝不 parse message 路由）。`packages/llm/llm/src/error.ts`
- invariant：每包 `src/invariant.ts` 经 `ctx.invariants.register` 注册；只能断言权威事件流/数据关系，违例抛 `InvariantError`（`code: 'INVARIANT'`）。`docs/subsystems/invariants.md`
- 事件命名：内部框架事件用 `internal/*` 前缀（`internal/dispatch`/`internal/plugin`/`internal/service`/`internal/status`）；公开事件 JSDoc 必须有 `@mode`（emit/parallel/waterfall）与 payload `@param`。`docs/event-producer-consumer.md`
- 失败要 loud：配置缺失自足则 load 时失败；不静默跳过缺失引用；空 `catch` 必须写明吞掉什么。`AGENTS.md:113`

## 9. 版本 / 发布 / 兼容性规范

- **family 版本机制**：`release/bump.ts --family dsh|vendor`；`dsh` family（`packages/*/*` + `apps/*` + root）共享一个版本，tag `dsh-v<ver>`；`vendor/*` 每包独立版本线，tag `vendor-<unscoped>-v`。`scripts/release/families.ts`
- 引用规则：对 workspace 成员的每个依赖必须用 `workspace:` 协议（手写 range 会让 `pnpm pack` 发布不存在的版本）。`scripts/check-workspace-constraints.ts:398`
- 发布纪律：**CI 从不写仓库**；bump 提交 `release(dsh): <ver>`，人类 merge 后打 tag 推送；发布顺序按 family 内依赖拓扑（consumer 晚于依赖）。
- 兼容性：Node `^22.19 || >=24`（CI 覆盖 22.19/24/26）；TS `target: es2024`、`module: esnext`、`moduleResolution: bundler`；全仓 ESM-only。
- 平台矩阵：**Linux 是 required 主 lane**；Windows 分 blocking（build+site）/ complete / observational（allowFailure）；另有 wine-windows-gates 兼容层。

## 10. 测试与质量门禁规范

- vitest 多配置分工：`vitest.config.ts`=unit（`*.spec.ts`，100% 覆盖率门）、`vitest.e2e.config.ts`=真实 API（`*.e2e.ts`，无 key 自跳过）、`vitest.web.config.ts`=Chromium（`*.e2e.ts`+`*.snapshot.ts`）、`vitest.snapshot.config.ts`=keyless 录制回放（`DSH_SNAPSHOT=replay` 默认）、`web-stress`/`web.perf`=可选压测/手工性能（不在 CI web 门内）。
- 命名：`*.spec.ts`=unit、`*.e2e.ts`=真实 API、`*.snapshot.ts`=浏览器快照、`*.stress.ts`=压测、`*.perf.ts`=手工、`*.compat.ts`=兼容套件。
- e2e 纪律：测试自管资源（harness 在测试内创建、afterEach 释放）；共享 fixtures 放普通 `tests/harness.ts`。
- mock-llm：`packages/test-support/llm-mock-server` 提供可脚本化 OpenAI 兼容 HTTP/SSE，20+ 种 behavior（`rate_limit`/`stall`/`malformed_json`/`tool_call_success`…）；`llm-replay` 从录制的 session.jsonl 重建模型流做 keyless 快照。
- CI 门禁（`scripts/run-gates.ts`）：`ci-primary`（静态组 + typecheck/lint + duplication + coverage + node-compat + snapshot + doc-sync + knip + build）、`ci-linux-primary`（+web snapshot）、`ci-static`（纯静态 + doc-sync，无 build 所有权）、`ci-windows-blocking/complete/observational` 三级、另有 `ci-coverage`/`ci-snapshot`/`ci-consumers`/`node-compat`/`check-all`/`doc-sync`。gate 带 needs 依赖图、并发调度、失败汇总逐项事实。
- lefthook（刻意不跑测试/快照/build）：pre-commit 跑 translation pairing + staged lint + THIRD_PARTY_NOTICES 再生成 + 空白检查 + vendor guard；pre-push 只跑 `pnpm run typecheck`（含 Typert contract 生成）。

## 11. 代码生成与一致性规范

- gen-* 脚本族（全部带 `--check` 模式）：`gen-tool-catalog`（工具 schema 目录）、`gen-config-catalog`（配置目录，交叉校验 schema 路径 ⊇ 类型）、`gen-client-catalog`（slot-catalog.ts）、`gen-cordis-catalog`（子系统 Cordis API 区块）、`gen-module-graph`（Mermaid 依赖图）、`gen-scoped-events`（scoped-event resolver 源码）、`gen-persistence-catalog`（持久化事件词汇表）、`gen-doc-graphs`、`gen-third-party-notices`。
- **生成物必须提交进仓库**，`--check` 模式在产物过期时 exit 1；THIRD_PARTY_NOTICES 由 pre-commit 在输入变化时再生成、spec 断言字节一致。

## 12. 对插件开发者的实践启示（会话结论的落地）

1. **别碰 single 槽**：第三方 priority 恒低，注册即 shadow 官方 UI 且破坏其子槽（如 directoryFlow 链路）。零风险扩展点只有 `list`/`keyed` 槽（`sidebar.footer.action`、`shell.overlay`、`conversation.chat.node`）。
2. **工作台类 UI 用 conversation.view 视图**（会话内 tab），数据天然在会话上下文，无需独立路由系统（官方无路由）。
3. **简历管理**：原文走"本地目录 + workspace + fs 工具"；结构化数据（候选人/推荐/协作）走 `ctx.storageDomain` + sqlite。attachment 只适合图片。
4. **协作**：dsh 只消费 MCP，对外协作需自建 MCP server 进程（Hub）；本地与 Hub 之间用 outbox 同步（官方 `domain/changed` 跨进程 deferred）。
5. **常驻/守护**：插件进程内做不了，全部放进程外宿主（Rust 壳 / 服务）。
6. **遵守包与导出约定**：`@deepseek-ai/dsh-<name>`、named-export 函数插件（`name/inject/Config/apply`，无 default）、`workspace:^` 引用、package.json 不变量，否则 CI 的 constraints/verify-* 会红。
7. **写文档就按 docs/ 分层 + .zh.md + .i18n.yaml**；导出必须带 JSDoc；事件标 `@mode`。

# DSH 插件评审标准（Review Standards）

> **版本**：v0.1.0（2026-08-15）
> **钉定 mainline**：`47f94385`（`@deepseek-ai/dsh-root` v0.1.0-rc.5，2026-08-13）——与 [review-checklist.md](review-checklist.md) 钉的同一 commit
> **溯源源稿**：[docs/source/dsh-design-conventions.md](source/dsh-design-conventions.md)（原《DSH 设计规范整理》，已复制入库做溯源）；源稿 40 条依据路径已逐条对照源码验证，5 处修正记录见[附录 A](#附录-a-溯源修正记录)

**性质**：非官方。这是把《DSH 设计规范整理》（官方源码行为分析）落成**可执行的审核标准**——每条规则带严重级、检查层与落地状态。判定站现有机器 gate（R1/R2/R3）是本文 P 集规则的**已落地实现**，本文成为它们的统一索引；人工层扩展 review-checklist。

---

## 0. 定位与分工

| 资产 | 层 | 与本文关系 |
|---|---|---|
| [plugin-standards.md](plugin-standards.md) | 行为建议（"怎么写不踩坑"） | 本文是它的**判定化**版本：把建议逐条转成可检规则 |
| [review-checklist.md](review-checklist.md) | 人工评审清单（A–I） | 本文扩展其未覆盖项（§5 给出映射） |
| **本文 review-standards.md** | **审核标准（规则总纲）** | 唯一规则索引，机器 gate 与人工清单都是它的落地 |
| `scripts/static-rules.mjs` | 机器静态 gate（R1/R2） | 已落地：P-101 / P-102 |
| CLI + `auditor/` | 机器运行时 gate（R3） | 已落地：P-103 |

**三集范围**（决定每条规则适用谁）：

- **P 集**（P-1xx~P-6xx）：第三方插件审核必检项——进 dsh-plugin-verify 判定流程
- **D 集**（D-1xx）：dsh-desktop（Rust 壳）架构基线——自己开发时遵守，不进插件判定
- **C 集**：官方贡献者规范——**不进审核**，仅作参考（§4）

---

## 1. 规则格式

### 1.1 严重级

| 级别 | 含义 | 违反后果 |
|---|---|---|
| **MUST** | 违反即不工作 / 架构红线 | 判定不通过 |
| **SHOULD** | 高风险反模式，官方明确不建议 | 判定通过但报告给 warning，人工层复核 |
| **MAY** | 选型/风格偏好 | 仅记录，不参与判定 |

### 1.2 检查层与落地状态

| 检查层 | 含义 | 落地位置 |
|---|---|---|
| `auto-static` | 纯文本/词法静态扫描，无运行时 | `scripts/static-rules.mjs` |
| `auto-runtime` | 运行时事件审计（mock-llm 循环内） | CLI + `auditor/` |
| `human` | 人工评审 | `docs/review-checklist.md` |

落地状态：`已落地`（规则已实现）/ `部分落地`（实现不完整，需扩展）/ `待落地`（本文提出，尚未实现）。

### 1.3 编号规则（永不复用）

- 规则 ID 一经发布**永不重编、永不复用**（append-only）。
- P 集按主题分段：`P-1xx` 入口与配置 / `P-2xx` 进程与资源 / `P-3xx` 数据 / `P-4xx` UI / `P-5xx` MCP 与对外互操作 / `P-6xx` 代码质量；D 集 `D-1xx` 起。
- 规则修订只改规则文本与文档版本（§6），不改 ID；新增规则追加本主题段内下一个空闲序号。

---

## 2. P 集：插件审核标准

### 主题 1 · 入口与配置

| ID | 级 | 检查层 | 规则 | 依据 | 落地 |
|---|---|---|---|---|---|
| P-101 | MUST | auto-static | 入口导出形态：namespace 形式（`name`/`inject`/`Config`/`apply` 命名导出）不得同时裸 `export default`——Loader 的 unwrapExports 优先取 `.default`，会丢 namespace 兄弟导出（inject 丢失 → 加载期崩溃） | postmortem 0001；`packages/AGENTS.md:5` | ✅ 已落地 ≡ R1-entry-shape |
| P-102 | MUST | auto-static | `cordis.patch.yml` 的 `!!js` 表达式只允许在插件 `config` 子树；entry metadata（`disabled` 等）出现表达式对象 = truthy 对象，条件配置被静默启用/禁用 | postmortem 0002；`AGENTS.md:96` | ✅ 已落地 ≡ R2-patch-yaml |
| P-103 | MUST | auto-runtime | 完整 agent 循环：7/7 waterfall 链（system-prompt/assemble → tools/post-execute）全部触发 + `tools/result` 收尾；结构化结果出现 `UNKNOWN_TOOL`（ToolNotFoundError）必须判失败，不能只比对输出 | mock-llm 方法论（Discussion 462） | ✅ 已落地 ≡ R3 |
| P-104 | SHOULD | human | 插件 `Config` 必须是可静态遍历的 schemastery 表达式（`z.object`/`z.intersect`）；动态表达式进不了配置目录、无法被交叉校验 | `scripts/gen-config-catalog.ts`（`walkSchemaExpr` 硬报错） | 待落地 |
| P-105 | MUST | human | 失败要 loud：配置缺失且自足则 load 时失败；不静默跳过缺失引用；空 `catch` 必须写明吞掉什么 | `AGENTS.md:113` | 待落地 |
| P-106 | SHOULD | auto-static | package.json 入口声明：`main` 指向存在的入口、`type: module`（R1 已查 main 存在性，需扩展 type/files 校验） | `packages/AGENTS.md:23` | 部分落地（扩展 R1） |

### 主题 2 · 进程与资源

| ID | 级 | 检查层 | 规则 | 依据 | 落地 |
|---|---|---|---|---|---|
| P-201 | MUST | human | 资源清理经 `ctx.effect(executor, label?)` 注册 disposer；事件监听返回 disposer、不裸监听不清理；卸载按逆序执行 | `vendor/cordis/src/fiber.ts`（disposer 逆序） | 待落地（review-checklist F 扩展） |
| P-202 | SHOULD | auto-static | 不裸 `child_process.spawn`：子进程必须经 `ctx.subprocess` 或等效生命周期管理——裸 spawn 逃逸 host-exit 同步 SIGKILL 回收 | `packages/subprocess/subprocess-local/README.md`、`src/spawn.ts` | 待落地（新增静态扫描：源码 import child_process / 直接 spawn 调用） |
| P-203 | SHOULD | human | spawn 命令用 scrubbed env：按 `/KEY|PASSWORD|SECRET|TOKEN/i` + 全部 `DSH_*` 剔除，保留 PATH/HOME/locale/proxy；刻意下发凭证走 spec 显式 `env` | `packages/subprocess/subprocess/src/index.ts:44` | 待落地（review-checklist H 对齐，给出官方正则） |
| P-204 | MUST | auto-runtime | attachment 只存图片（png/jpeg/webp/gif），内容寻址 `sha256:<digest>`；**禁止**用 attachment 承载 PDF/Word/简历 | `packages/attachment/attachment`（`ImageMediaType` 四值） | 待落地（auditor 扩展：监听 attachment 写入类型） |

### 主题 3 · 数据

| ID | 级 | 检查层 | 规则 | 依据 | 落地 |
|---|---|---|---|---|---|
| P-301 | MUST | human | 结构化数据走 `ctx.storageDomain`（`defineDomain(spec)` 声明 zod 记录 schema）；**产品包不直接碰 backend**（不裸写 storage-sqlite/json） | `docs/subsystems/storage.md`、`packages/storage/storage-domain` | 待落地 |
| P-302 | MAY | human | 选型：高频变更数据选 sqlite（document-per-row STRICT + WAL），低频可读选 json；注意单写自动原子、无多进程写保护、无迁移 | `packages/storage/storage-sqlite/README.md` | 待落地 |
| P-303 | SHOULD | human | 跨进程同步自建 outbox：`domain/changed` 是进程内事件，跨进程推送官方明确 deferred | `packages/storage/storage-domain/README.md:22,34` | 待落地 |

### 主题 4 · UI

| ID | 级 | 检查层 | 规则 | 依据 | 落地 |
|---|---|---|---|---|---|
| P-401 | MUST | human | **不注册 `single` 槽**：第三方 priority 自动递减（-1、-2…），注册即 shadow 官方 occupant 且破坏其子槽声明；零风险扩展点只有 `list`/`keyed` 槽（`sidebar.footer.action`、`shell.overlay`、`conversation.chat.node`） | `packages/client/ui-slots/src/index.ts`（priority 低者胜出）、`slot-catalog.ts`（42 槽 + replaceRisk 标注） | 待落地 |
| P-402 | SHOULD | auto-static | 对外贡献 UI 必须 `inject: ['slots']` 且经 `ctx.slots.inject(key, ...)` 声明存在——注册进未声明槽直接抛错 | `packages/client/AGENTS.md`（slots 注入约定） | 待落地（静态扫描：源码含 `ctx.slots` 时查 inject 数组） |
| P-403 | SHOULD | auto-static | UI 插件声明 `dsh.client` manifest（`platform: 'web'`、exports `./client`），否则产物不进入前端 bundle | `packages/client/AGENTS.md:94` | 待落地 |
| P-404 | SHOULD | human | UI 文案：`locales.ts` 导出 `zh`（键集权威源）与 `en`（`satisfies Record<ThemeKey, string>` 强制键集完整） | `packages/client/locale/README.md` | 待落地 |

### 主题 5 · MCP 与对外互操作

| ID | 级 | 检查层 | 规则 | 依据 | 落地 |
|---|---|---|---|---|---|
| P-501 | SHOULD | human | **dsh 只消费 MCP，不生产 MCP server**；要把能力暴露给其它实例，需自建 MCP server 进程（或暴露 ACP server：`packages/acp/acp`） | `packages/mcp`（仅 mcp-client）；`apps/cli/reference/README.md:80` | 待落地 |
| P-502 | SHOULD | human | 不依赖 MCP server 的 Resources/Prompts（只有 tools 被桥接、其余被 defer）；streamable-http 认证上限是静态 headers（无 OAuth 动态流程） | `packages/mcp/mcp-client/README.md` | 待落地 |

### 主题 6 · 代码质量

| ID | 级 | 检查层 | 规则 | 依据 | 落地 |
|---|---|---|---|---|---|
| P-601 | SHOULD | human | error `code` 是稳定契约（可 switch），`message` 是诊断 prose；**绝不 parse message 路由** | `packages/llm/llm/src/error.ts:14-15` | 待落地 |
| P-602 | SHOULD | human | 导出符号带 JSDoc（描述/参数/返回值），未知形态 fail closed | `scripts/verify-export-jsdoc.ts` | 待落地 |
| P-603 | MAY | human | 公开事件 JSDoc 标 `@mode`（emit/parallel/waterfall）+ payload `@param`；内部框架事件用 `internal/*` 前缀 | `docs/event-producer-consumer.md` | 待落地 |

---

## 3. D 集：dsh-desktop 架构基线

Rust 壳/宿主的自检清单（不进插件判定，dsh-desktop 开发迭代时逐条对照）。

| ID | 级 | 规则 | 依据 |
|---|---|---|---|
| D-101 | MUST | 常驻/守护/崩溃重启**全部在进程外宿主**（Rust 壳/服务）：dsh 无 daemon，`Loader.exit()` 是空实现 | `apps/cli/README.md`、`vendor/loader/src/index.ts` |
| D-102 | MUST | host exit 同步回收进程树：复刻 `taskkill /T /F`（Windows）与进程组树级信号（POSIX）语义，不留孤儿 | `packages/subprocess/subprocess-local/README.md` |
| D-103 | MUST | 沙箱 fail-closed：`confine` 必须返回 enforcing argv 或拒绝，**静默的非受限透传被禁止**；SandboxMode 仅 `read-only / workspace-write / danger-full-access` 三种 | `docs/subsystems/sandbox.md:170` |
| D-104 | MUST | spawn 子进程 env 脱敏：按 `/KEY|PASSWORD|SECRET|TOKEN/i` + 全部 `DSH_*` 剔除，保留 PATH/HOME/locale/proxy | `packages/subprocess/subprocess/src/index.ts:44` |
| D-105 | MUST | 子进程契约：`detached: true` 仅为拿进程组根做树级信号，**不是**持久化手段 | `packages/subprocess/subprocess-local/src/spawn.ts` |
| D-106 | MUST | Node 兼容 `^22.19 || >=24`；全仓 ESM-only、`target: es2024`（Node 自举版本按此定） | §9 版本/兼容（文档源稿） |
| D-107 | SHOULD | 平台矩阵：Linux 是官方 required 主 lane；Windows 分 blocking/complete/observational 三级——dsh-desktop 以 Windows 为产品主目标时，注意官方主验证链在 Linux | 同上 |
| D-108 | SHOULD | 嵌入官方 Web UI 时遵守主题加载序：`scrollbar.css` 必须后于 `design-platform.css`（`--dsw-alias-scrollbar-*` 独有消费者）；token 三层 `--dsw-static-*`→`--dsw-alias-*`→`--dsw-specific-*` | `packages/client/ui-theme/src/styles/` |
| D-109 | SHOULD | 依赖官方 npm 包时按 `vendor` 版本线精确钉定（每包独立版本线，tag `vendor-<unscoped>-v`）；本仓（判定站/生态工具）引用 dsh 包用 `workspace:` 协议 | `scripts/release/families.ts`、`scripts/check-workspace-constraints.ts:402` |
| D-110 | SHOULD | 对外暴露 dsh 能力：自建 MCP server 进程或 ACP server（`packages/acp/acp`，stdio JSON-RPC），**不冒充官方接口** | §3 MCP、`packages/acp/acp/README.md` |

---

## 4. C 集：官方贡献者规范（不进审核）

仅在给官方仓库提 PR / 深度参与官方开发时参考，插件判定与 dsh-desktop 开发**不需要**遵守：

- 文档预算 `verify-doc-budgets`（词数上限只降不升，≥5% 余量）；`verify-md-wrap` 段落单行、`verify-md-links` 相对链接 + fragment 命中、`doc-typecheck` 编译 md 内 ts 代码块
- 双语文档 `.zh.md` + `.i18n.yaml`（git blob hash 配对）；doc-sync gate
- family 版本机制（`release/bump.ts --family dsh|vendor`）；CI 从不写仓库，bump 提交人工 merge 后打 tag
- 每包 `src/types.ts` 只含类型无运行时代码、`src/invariant.ts` 注册 invariants；`pnpm run constraints` 强制 package.json 不变量
- gen-* 脚本族产物**必须提交进仓库**，`--check` 模式过期 exit 1
- 平台矩阵、CI gate 依赖图、lefthook 分工（pre-commit 不跑测试/快照/build）

---

## 5. 落地映射（现有资产 → 规则）

| 现有资产 | 对应规则 | 备注 |
|---|---|---|
| `static-rules.mjs` R1-entry-shape | P-101 | 已实现 |
| `static-rules.mjs` R2-patch-yaml | P-102 | 已实现 |
| CLI + auditor R3（7/7 waterfall + tools/result + UNKNOWN_TOOL） | P-103 | 已实现 |
| review-checklist A（入口/加载） | P-101 人工复核面 | 保留 |
| review-checklist B（组合配置） | P-102 人工复核面 | 保留 |
| review-checklist C–E、G、I | 暂无规则编号（正交上报/双端契约/异步状态/回调隔离/link 形态） | 保持独立，不强行归入 |
| review-checklist F（资源释放） | P-201 | 本文扩展 dispose 范围到所有 ctx.effect |
| review-checklist H（输出卫生） | P-203 | 给出官方精确正则对齐 |

**判定流程分工**（维持现有）：机器 gate（P-101/102/103）= 确定性信号 → 人工层（review-checklist + P 集 human 项）= 评审 → 两者都不是官方背书。

---

## 6. 版本与迭代规程

### 6.1 版本号

- 本文独立 SemVer：`v0.1.0` 起；`0.x` = 标准草案期（规则可增补），`1.0` = 稳定（进入 1.0 后破坏性修订需升主版本）。
- **钉定 mainline commit 必须随规则依据同步更新**：规则引用官方源码行为，mainline 漂移后需重验并 bump 文档版本（哪怕规则未变，只改"钉定 commit"字段也 bump patch）。
- 每次重验走一遍[附录 A](#附录-a-溯源修正记录)的验证方式（逐路径对照）。

### 6.2 规则生命周期

```
提案（本文增补 [待落地]）→ 实现（static-rules.mjs / auditor / review-checklist）
→ 验证（对真实插件跑判定）→ 标记 [已落地] → 进发布（bump 版本）
```

- 新增规则：追加本主题段空闲序号，**不重排已有 ID**。
- 规则语义修订：改规则文本 + 变更记录 + bump 版本；ID 不变。
- 机器层新规则落地时，同步更新 [review-checklist.md](review-checklist.md) 的"与自动验证的关系"段落。

### 6.3 变更记录

| 版本 | 日期 | 变更 | 影响规则 |
|---|---|---|---|
| v0.1.0 | 2026-08-15 | 初版：从《DSH 设计规范整理》（钉定 `47f94385`）落地 P/D/C 三集；R1/R2/R3 归入 P-101/102/103；溯源修正 5 处（附录 A） | — |

---

## 附录 A · 溯源修正记录

源稿《DSH 设计规范整理》40 条依据路径逐条对照源码（HEAD `47f94385`）验证，**35 条完全吻合**，5 处修正：

| # | 源稿表述 | 实测 | 处理 |
|---|---|---|---|
| 1 | ui-slots「声明即独占」位于 `index.ts:787` | 实际在 `index.ts:142`（"Declaring is claiming…"）；787 行是 register 实现，语义一致 | 本文 P-401 依据只引文件不引行号 |
| 2 | 「约 50 个槽」 | slot-catalog.ts 实为 **42 个** | 本文 P-401 用 42 |
| 3 | 组件样式「PascalCase 组件名 + .module.css」 | `web-styling.md:11` 只讲"组件样式 CSS Modules 放组件旁"；全仓无 "PascalCase" 一词 | 命名约定不可溯源，**不收录**为规则 |
| 4 | 五张 sheet / verify 脚本位置 | sheet 在 `ui-theme/src/styles/` ✓；五个 verify 脚本在 **`scripts/`**（非源稿暗示的 packages/locale/scripts） | 本文 C 集按实际位置引用 |
| 5 | docs/ 分层含 cordis-tutorial | `docs/AGENTS.md` 分层表为 architecture/subsystems/postmortem/cookbook/user/development；cordis-tutorial 作子目录存在 | 本文 C 集不引用该分层细节 |

另确认：`docs/defensive-patterns.md` 存在，postmortem 0001/0002 主题与 review-checklist.md 描述一致；"dsh 只消费 MCP 不生产"在文档层成立（`apps/cli/reference/README.md:80` 明言 no MCP server enabled by default）。

---

## 附录 B · 与《DSH 设计规范整理》章节映射

| 源稿章节 | 落入规则 |
|---|---|
| §1 插件系统（Cordis） | P-101/102/104、P-201 |
| §2 进程与执行 | P-202/203、D-101~105 |
| §3 MCP | P-501/502、D-110 |
| §4 数据与持久化 | P-204、P-301~303 |
| §5 UI 与前端（slot） | P-401~404 |
| §6 视觉与主题 | D-108 |
| §7 i18n/文档 | P-404、C 集 |
| §8 代码与工程 | P-105/106、P-601~603、C 集 |
| §9 版本/发布/兼容 | D-106/107/109、C 集 |
| §10 测试与质量门禁 | C 集 |
| §11 代码生成与一致性 | C 集 |
| §12 对插件开发者的实践启示 | P-401/301/501/202、D-101（散落） |

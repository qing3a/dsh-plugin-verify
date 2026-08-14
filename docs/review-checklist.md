# 插件评审检查表（人类评审层）

> 来源：官方 `docs/defensive-patterns.md` 7 条防御模式 + `docs/postmortem/` 0001/0002 事故复盘
> （deepseek-harness mainline `47f94385`，2026-08-14 摘录）。
> 与自动验证的关系：dsh-plugin-verify 的静态规则（R1/R2）与运行时规则（R3/waterfall）是
> **机器确定性 gate**；本表是**人类评审层**——自动验证只能算"信号"，不能宣称官方背书。
> 逐条核对后把结论写进验证报告的 `detail` 或评审笔记。
> **规则索引**：本文 A–I 是人工评审基表；[review-standards.md](review-standards.md) 是全部规则的
> 统一索引（P-1xx~6xx 插件必检 / D-1xx dsh-desktop 基线 / C 集官方贡献），本文未覆盖项
> （如 P-201 资源清理经 ctx.effect、P-203 输出卫生官方正则、P-401 single 槽红线、P-301 数据走
> storageDomain）以该文档为准。

## A. 入口与加载（postmortem 0001）

- [ ] **无裸 `export default`**：namespace 形式（`name`/`inject`/`Config`/`apply` 命名导出）不得同时 `export default <apply>`——Loader 的 `unwrapExports` 优先取 `.default`，会丢弃 namespace 兄弟导出，`inject` 丢失 → 加载期崩溃（R1 已自动查，此处人工复核）
- [ ] **default 出口完整性**：若确实用 `export default`，default 对象必须自身带 `name`/`inject`/`Config`/`apply`
- [ ] **不在 `inject` 的服务用 `ctx.get(name)`**：`ctx.<name>` 属性走 ancestor-only fiber walk，经 foreign shadow 会失败；`ctx.get()` 走 isolate-keyed global store 无拓扑依赖

## B. 组合配置（postmortem 0002）

- [ ] **`!!js` 只在 `config` 子树**：entry metadata（`disabled` 等）的表达式对象是 truthy、不会被插值求值 → 条件配置被静默启用/禁用（R2 已自动查，此处人工复核）
- [ ] **条件启用用 overlay**：不要用 `disabled: !!js ...` 做条件组合；用显式 overlay/patch 文件
- [ ] **工具注册语义断言**：结构化结果中出现 `UNKNOWN_TOOL`（`ToolNotFoundError`）必须判失败，不能只比对 expected output（R3 已自动查）

## C. 正交结果独立上报（defensive 1）

- [ ] 超时/信号/退出码/错误是独立事实，各自单独上报——不得把某个失败折叠进"成功"分支
- [ ] 插件报告的 `isError` 与 message/code 不互相吞并

## D. 双端契约（defensive 2）

- [ ] 公共方法只返回文档声明的归一化结果形态
- [ ] 所有错误来源形式（throw / finish{kind:'error'|'aborted'} 等）都经真实消费方测一遍

## E. 异步状态 ≠ 同步状态（defensive 3）

- [ ] 不用 `agent/status`/`whenIdle()` 当作单次 follow-up 的完成信号（多个排队 follow-up 共享一个 running 区间）
- [ ] 拥有 run 的自动化调用者必须显式定义区间（durable inbox receipt → 下一次 whole-agent idle），输出描述为区间级而非因果归因
- [ ] 有"没有可等的东西"分支（等待的 transition 永不发生时不挂起）

## F. 资源释放（defensive 4）

- [ ] `dispose` 必须 async 且 await 子进程退出（kill → await done），不留孤儿
- [ ] 先关 listener/notification 注册表再 kill，迟到的完成保持静默
- [ ] 验证后自清理（removePlugin/removeAuditor）必须做——残留 link 会污染后续所有验证（CLI 已内置）

## G. 回调隔离（defensive 5）

- [ ] 回调分发循环 try/catch + log——单个坏 listener 不能 reject 所在 promise、不能饿死后续 listeners
- [ ] 一个 subscriber 抛错不影响核心生命周期

## H. 输出卫生（defensive 6）

- [ ] spawn 命令用 scrubbed env（去掉 `*KEY*`/`*SECRET*`/`*TOKEN*`/`*PASSWORD*`）——防凭据泄漏进 output/env/spill 文件
- [ ] temp/spill 文件用私有目录（0700）+ 随机名 + 独占 owner-only open（`'wx'`/`0o600`）——可预测的 world-readable 路径招致 symlink 竞争

## I. link 形态路径（defensive 7）

- [ ] 删除路径前先 `lstat().isSymbolicLink()` 判断；link 用 `unlink()`（不跟随进入 target）
- [ ] Windows junction 用 unlink；递归 `rmSync` 只留给已知真实目录

---

### 判定边界

- 自动验证 = 信号（R1/R2/R3 + waterfall 链）；本表 = 人工评审；两者都不是官方背书。
- 评审结论要写进验证报告（`detail` 或附 note），做到"证据可复现"。

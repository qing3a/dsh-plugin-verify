# 无 API Key 验证 DSH 插件：mock-llm 实战与 waterfall 捕获实证（三）

> 系列第三篇。前两篇讲了插件结构范式与踩坑全记录，这篇聚焦**运行时验证**——插件生态最大的空白（雷达 286 插件仅 5 测 0 过），给出一个零成本、可复制的完整方案，附带实测数据。
>
> 配套：GitHub Discussion 462（精简版）、dsh-event-auditor/docs/runtime-validation.md（命令速查版）、本文（完整原理+踩坑）。

---

## 一、为什么运行时验证是"看不见但致命"的

静态检查（schema、patch 结构、类型检查）能证明**插件能加载**，但证明不了**插件在真实运行时不破坏行为**。

最典型的陷阱是 **waterfall 事件监听器**。`tools/execute`、`approval/request`、`fs/write-intent`、`llm/stream` 这类事件走 waterfall 分发——监听器拿到 `next()`，只有调用它并透传返回值，下游的默认行为才会执行。仓库的常设纪律写得明明白白：

> 只负责观察或标注的 waterfall 监听器必须调用 `next()`；不调用就直接返回代表有意短路。

如果一个观察型插件忘了调 `next()`，后果是**静默的**：agent 循环会诡异卡住、工具调用无结果、审批永远不通过——没有任何报错，只有行为异常。这类 bug 在单元测试和类型检查里完全隐形，只在真实 agent 循环里暴露。

而"真实 agent 循环"传统上意味着：真实 LLM API key + token 消耗 + 依赖外部服务。对只想验证插件的开发者来说成本过高。本文的解法：用 DSH 仓库**自带的 mock-llm 服务器**，零成本复现完整 agent 循环。

## 二、方案总览：四个角色一条链

```
┌─────────────────┐      ┌──────────────────────────┐      ┌──────────────────────┐
│ mock-llm 服务器  │◄─────│ DSH headless profile      │◄─────│ 你的插件（挂监听）      │
│ （脚本化 LLM 响应）│      │ （真实 agent 循环，无 UI）  │      │  （观察/透传 next()）   │
└─────────────────┘      └──────────────────────────┘      └──────────────────────┘
        │                            │                               │
        └── tool_call_success ──────►│                               │
        （要求模型调用 bash 工具）      └────────── waterfall 链完整走一遍 ──►│
                                                                      │
                                                              DSH_EVENT_AUDIT_DUMP
                                                              进程退出时把事件审计写盘
```

- **headless profile**：`dsh --profile headless "prompt"`，无 UI 的 agent 循环，命令行直喂
- **mock-llm**（`@deepseek-ai/dsh-llm-mock-server`）：OpenAI 兼容的脚本化服务器，按 `--sequence` FIFO 返回预设行为。`tool_call_success` 让模型"调用 bash 工具"——这一步是整个方案的关键，它触发 `tools/pre-execute → execute → post-execute` 全链
- **DSH_EVENT_AUDIT_DUMP**：dsh-event-auditor 提供的环境变量——进程 `exit` 时把事件审计快照同步写盘（headless 没有 webServer，这是无 HTTP 场景的审计出口）

## 三、完整命令（一步步来）

### 3.1 环境与构建（一次性的坑已在第二篇，这里只给结论）

```sh
corepack enable && corepack prepare pnpm@11.7.0 --activate
git clone --filter=blob:none --sparse --depth=50 https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
git sparse-checkout set packages vendor native apps website patches scripts docs  # 一次加全！
pnpm install --frozen-lockfile
pnpm run build:lib:host && pnpm run build:lib:client
pnpm --filter @deepseek-ai/dsh-web-frontend run build   # web profile 需要
```

### 3.2 双 profile 安装你的插件

```sh
pnpm dsh plugin --profile web add link:<你的插件绝对路径>
pnpm dsh plugin --profile headless add link:<你的插件绝对路径>
```

### 3.3 插件要能跑 headless：两个必要条件

**① 可选服务必须用 `ctx.inject` 动态注入**，不能用 `inject` 数组，也不能用 `ctx.get` 直接读：

```ts
// ❌ inject: ['webServer'] —— headless 没有 webServer，会 pending 阻塞加载
// ❌ ctx.get('webServer') —— 未注入时直接抛 "cannot get property without inject"
// ✅ 动态注入（installSettingsSection 同模式）：
ctx.inject(['webServer'], (sctx) => {
  sctx.effect(() => registerAuditRoutes(sctx.webServer, auditor), 'event-auditor: routes')
})
```

这是本次踩到最隐蔽的坑：`ctx.get` 的安全机制是**抛错而非返回 undefined**，文档不会告诉你。

**② 无 webServer 时的审计出口**：环境变量 dump（见 3.4）。

### 3.4 启动 mock-llm

```sh
pnpm run mock:llm --port 8000 --api-key mock-key \
  --sequence tool_call_success,success --repeat-last \
  --tool-name bash --tool-arguments '{"command":"ls"}'
```

三个要点：
- `tool_call_success`：第一个请求返回"调用 bash 工具"（`--tool-name bash --tool-arguments '{"command":"ls"}'` 指定）
- `success`：第二个请求正常回复（工具结果之后模型要收尾）
- `--repeat-last`：序列耗尽后复用最后一项，防止超长对话 500

**⚠️ 坑**：`pnpm run mock:llm -- --port ...` 会报 `Unexpected argument '--port'`——`--` 会被当成位置参数传给 bin.ts，必须直接 `pnpm run mock:llm --port ...`。

### 3.5 跑 headless agent + 导出审计

```sh
DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1 \
DEEPSEEK_API_KEY=mock-key \
DSH_EVENT_AUDIT_DUMP=/tmp/audit.json \
pnpm dsh --profile headless "run the bash tool once and report"
```

正常结束的标志：输出 `mock response recovered`——agent 完整跑完了一轮（工具调用 + 结果回收 + 模型收尾）。

## 四、什么算"通过"：五条验证标准

```sh
python -c "
import json
d = json.load(open('/tmp/audit.json'))
print('byMode:', d['byMode'])
print('事件类型:', list(d['counts'].keys()))
"
```

| # | 标准 | 含义 |
|---|---|---|
| 1 | `byMode` 同时含 `emit` 和 `waterfall` | waterfall 监听器确实注册了 |
| 2 | waterfall 链完整：`system-prompt/assemble → agent/pre-step → agent/request → llm/stream → tools/pre-execute → tools/execute → tools/post-execute` | 整个决策管线被观测到 |
| 3 | agent 输出 `mock response recovered` | **所有 waterfall 监听器都透传了 next()，零副作用**（这是最重要的安全证明） |
| 4 | （web profile）`/api/audit/events`、`/audit` 页 200 | HTTP 出口正常 |
| 5 | reset 后计数归零 | 生命周期可重置 |

标准 3 是杀手锏：如果哪个 waterfall 监听器吞了 `next()`，agent 循环会在工具调用后卡死或行为异常——`mock response recovered` 是"行为完好"的最强证据。

## 五、实测数据（dsh-event-auditor，2026-08-14）

```
byMode: {'emit': 62, 'waterfall': 12}
总事件数: 74
事件类型: [tools/change, subagent/provider-added, session/created, agent/created,
          agent/session-start, agent/inbox/inserted, agent/status, agent/inbox/claimed,
          system-prompt/assemble, agent/pre-step, agent/request, llm/stream,
          tools/pre-execute, tools/execute, tools/post-execute, tools/result,
          subagent/provider-removed]
```

捕获到的完整 agent 生命周期（这就是 waterfall 链的证据）：

```
session/created → agent/created → agent/session-start
→ agent/inbox/inserted → agent/status → agent/inbox/claimed
→ system-prompt/assemble (waterfall) → agent/pre-step (waterfall) → agent/request (waterfall)
→ llm/stream (waterfall) → tools/pre-execute (waterfall) → tools/execute (waterfall)
→ tools/post-execute (waterfall) → tools/result
```

一个有趣的观察：**waterfall 事件的参数在 dump 里多为 null**——Scoped 事件的 `this` 绑定与部分 payload 不可 JSON 序列化（审计记录把它规范成 null）。这不影响捕获本身，但提醒做审计工具的人：**参数快照要做防御性序列化**（dsh-event-auditor 的 AuditorService 就是为此设计的——超限截断 + 不可序列化降级为标记）。

## 六、给生态的话

radar 显示 286 个插件只有 5 个做过运行时测试、0 个通过。**不是插件都坏了，是验证方法缺失**。这套方案把成本压到了零（无 key、无 token、命令式、可重复），任何插件作者都能用它验证自己的 waterfall 监听器。

如果你用这套方案验证了你的插件，欢迎：
- 在 [Discussion 462](https://github.com/deepseek-ai/deepseek-harness/discussions/462) 贴你的 `byMode` 数据——让"运行时通过"的插件数量从 0 涨起来
- 提 PR 给 awesome-dsh-plugins 补充运行时测试证据（它有四层证据模型 L0-L4，L4 就是运行时测试）

**一起把"运行时 0 通过"变成过去式。**

---

*系列至此三篇：结构范式 → 踩坑全记录 → 运行时验证。工具：github.com/qing3a/dsh-event-auditor（dsh-plugin topic，含完整设计文档与验证记录）。*

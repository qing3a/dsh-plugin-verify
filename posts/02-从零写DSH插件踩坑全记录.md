# 从零写一个 DSH 插件并跑通：踩坑全记录（二）

> 系列第二篇。上一篇拆了 dsh-web-ui 的结构范式，这篇讲实战：把一个插件从骨架代码跑成真实运行的 DSH 插件——包含完整的踩坑记录。**诚实预告：这不是一帆风顺的故事，中间断了 6 次，但每断一次都更接近真相。**

## 前情提要

我按第一期的范式写了个 `dsh-event-auditor`（事件审计面板），代码是"按文档写的"。本文记录的是从"文档版本"到"能跑版本"的全过程——核心结论：**文档和源码之间存在 6 个看不见的坑，每个坑都是一次真实调试。**

## 环境与目标

- Windows 10（Git Bash），Node 24 / pnpm 11.7（仓库锁版，corepack 激活）
- C 盘仅剩 9.4G（98% 已用）——全程在磁盘红线边缘构建
- 目标：DSH web profile 加载插件 → `GET /api/audit/events` 返回事件 JSON

## 坑 1：pnpm 版本被仓库锁死

`pnpm install` 报错，因为仓库固定 `pnpm@11.7.0`，本机是 9.15。解法：`corepack enable && corepack prepare pnpm@11.7.0 --activate`。

**教训**：先读 `docs/development.zh.md` 的"前置条件"段再动手。

## 坑 2：cordis 不在 packages/ 里，在 vendor/

`pnpm dsh --version` 报 `ERR_MODULE_NOT_FOUND: @deepseek-ai/cordis`。查 `pnpm-workspace.yaml` 才知道：**cordis 全家（cordis/schemastery/loader/group…）是 vendor 目录下的 fork**。blobless sparse clone 没 checkout vendor/，导致 workspace 链接全断。

**解法**：`git sparse-checkout add vendor native apps website patches`——每个目录都是一个踩出来的缺失。

## 坑 3：API 漂移——npm rc 版 vs master 源码

这是**最有价值的一个坑**。我的骨架按 npm 版 API 写（`ctx.httpServer` / `HttpServerService`），但 profile 从本地 workspace 链接源码，跑的是 master 语义。启动报错：

```
@dsh-external/dsh-event-auditor: pending (waiting for service: httpServer)
```

实际上 master 的服务名是 `ctx.webServer`。**npm rc 版（0.0.1-rc.1）和 master 源码的命名不同**。

**解法**：鸭子类型接口。`register(route: {kind, path, handler})` 签名两边一致，只跟随服务名：

```ts
export interface RouteRegistrar {
  register(route: { kind: 'exact' | 'prefix'; path: string; handler: (req, res) => void | Promise<void> }): () => void
}
```

**通用经验**：`@deepseek-ai/*` 的 rc 版与 master 可能有漂移。遇到疑似漂移，读**实际运行版本**的 `lib/types/`，别读文档。

## 坑 4：web profile 需要前端 dist

逐层推进时依次遇到：缺 `lib/typert.host.js`（host 构建产物）→ 缺 `dsh-client-*` 的 lib（client 构建产物）→ 缺 `apps/web/dist/index.html`（Vite 前端构建）。三个构建缺一不可：

```sh
pnpm run build:lib:host && pnpm run build:lib:client
pnpm --filter @deepseek-ai/dsh-web-frontend run build
```

## 坑 5：ESM 扩展名与 @types

`import './auditor'` 在 Node ESM 下失败——**必须写 `.js` 后缀**（TS 编译不自动加）。同时 `tsconfig` 里 `types: []` 会禁用 `@types/node`。两处都要改。

## 坑 6：git push 被网络墙

`git push` 连 github.com:443 超时，但 `gh api`（api.github.com）畅通。解法：**Contents API 逐文件上传**（社区文档里提过这个 fallback），写了个 34 行的脚本 `scripts/push-via-api.mjs` 复用。

## 成功时刻

修正全部 6 个坑后，`pnpm dsh --profile web` 打印出 `dsh web: http://127.0.0.1:3080`，然后：

```bash
$ curl http://127.0.0.1:3080/api/audit/events
{"counts":{"tools/change":57},"byMode":{"emit":57},...}
$ curl -X POST http://127.0.0.1:3080/api/audit/reset
{"ok":true}
```

插件在 DSH 启动过程中就捕获了 57 次工具注册事件——审计面板真的在工作。

## v0.2：waterfall 事件（next() 纪律实战）

第二版加入 10 个 waterfall 事件观察。关键：**waterfall 监听器必须调用 `next()` 并透传返回值**，否则静默吞掉下游默认行为。从源码逐条确认签名（next 均无参）：

```ts
'approval/request'(req, next: () => Promise<ApprovalOutcome>): Promise<ApprovalOutcome>
'fs/write-intent'(target, actor, next): Promise<FsWriteIntent | undefined>
```

观察型透传写法：

```ts
function watchWaterfall(ctx, event, handler) {
  return ctx.on(event, (...args) => {
    handler(...args)
    const next = args[args.length - 1]
    return typeof next === 'function' ? next() : undefined
  })
}
```

验证结果：插件加载后 DSH 完整启动、首页 200——**启动路径上的 waterfall 都正常透传，next() 纪律安全性验证通过**。

## 状态与仓库

- 仓库：`github.com/qing3a/dsh-event-auditor`（`dsh-plugin` topic 已打，雷达每日扫描自动收录）
- 已验证：启动捕获事件、GET/POST 接口、/audit 页面
- 待验证：waterfall 的运行时捕获（需要真实 LLM 对话触发 `tools/execute` 等，本地无 API key）

## 给后来者的清单

1. 先读 `docs/development.zh.md` 前置条件
2. sparse-checkout 一次加全：`packages vendor native apps website patches scripts docs`
3. 三个构建缺一不可：host lib + client lib + web-frontend dist
4. API 以**实际运行版本**为准，怀疑漂移先读 `lib/types/`
5. ESM import 带 `.js` 后缀；`@deepseek-ai/cordis` 只放 devDeps
6. waterfall 只观察必须 `next()`；`ctx.effect` 包所有资源
7. git push 不通时，Contents API 是救命的 fallback

下一篇预告：**第三篇——用 audit 面板发现 harness 事件流的真实规律**，或选题由你定。

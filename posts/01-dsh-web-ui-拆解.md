# 从零拆解 DSH 插件集（一）：dsh-web-ui 全景与插件集范式

> 系列导读：本系列拆解 DeepSeek Harness（DSH）生态里的头部插件，提炼可复用的插件设计与结构范式。第一篇选 dsh-web-ui——目前社区最完整的插件集形态样例。
>
> 数据截至 2026-08-13：核心仓库 30.1k★，`dsh-plugin` topic 下 345 个仓库，社区雷达收录 286 个、运行时验证几乎空白。生态里"会做插件"的人还很少，每一个拆解都是稀缺内容。

---

## 为什么拆 dsh-web-ui

DSH 的设计哲学是"Everything is a Plugin"，但官方文档教你的是**单个插件怎么写**，没人教你**一套插件怎么组织**。dsh-web-ui 恰恰补上了这个空白：

- 它是**插件集**，不是单插件——11 个包可以独立装、也可以一包装齐
- 它有 **328★**，是社区里验证过的分发形态
- 它跨了三种插件品类：功能插件（看板、SSH、远程控制）+ UI 增强（宠物、皮肤、实时统计）+ 聚合分发（all 包）
- 它走完了完整生命周期：npm 发布 → `dsh plugin add` → 用户侧边栏使用 → 设置中心管理

一句话：**如果你想把"一堆想法"变成一个"产品化插件集"，这是目前最好的参考。**

## 一、它是什么

官方定位："dsh-web-ui 是 DeepSeek Harness（DSH）Web UI 的插件与皮肤集合"。安装只需一行：

```bash
dsh plugin --profile web add @linxin666/dsh-web-ui-all
```

装完重启 dsh web，侧边栏出现全部入口。开发者模式用本地链接：`dsh plugin --profile web add link:$(pwd)/packages/dsh-web-ui-all`（需要 Node ≥ 22 + pnpm）。

它的 11 个包覆盖的功能矩阵：

| 包 | 功能 | 品类 |
|---|---|---|
| dsh-task-board | 看板：5 状态列、卡片直接触发真实 agent 执行、cron 定时任务 | 功能 |
| dsh-git-graph | Git 分支泳道与提交历史可视化 | 功能 |
| dsh-aionui-panel | 右侧面板：文件树、多格式预览、SCM stage/unstage/discard | 功能 |
| dsh-pet | 鲸娘桌面宠物（响应 agent 状态、可喂食命名拖动） | UI 增强 |
| dsh-live-stats | 实时 token 统计（TPS/延迟/上下文/缓存命中率） | 功能 |
| dsh-remote-web-ui | 移动端远程控制（QR 配对、一次性 token、LAN/cloudflared tunnel） | 功能 |
| dsh-ssh | SSH：web 终端、SFTP、端口转发、集群命令、agent 直连 | 功能 |
| dsh-web-ui-settings | 设置中心总开关 | 基建 |
| dsh-skins | 7 套皮肤（XP Luna、Minecraft、QQ2008 等，先试后换） | 皮肤 |
| dsh-web-ui-all | 聚合包 | 分发 |

注意 `dsh-pet`——一个"鲸娘桌面宠物"。社区插件里这类"人味"功能不是点缀，它验证了一个事实：**DSH 插件不只有工程师向的工具，UI/趣味性方向有真实需求**（雷达里还有 whale-girl 皮肤系列、dsh-gomoku、dsh-auto-chess 等游戏插件）。这也是你选插件题目的一个判断依据。

## 二、仓库怎么组织

```
dsh-web-ui/
  package.json / pnpm-workspace.yaml / pnpm-lock.yaml   # pnpm monorepo
  packages/          # 11 个独立可发布插件包
  shared/            # 共享代码
  scripts/           # 构建/发布脚本
  docs/  gallery/    # 文档与皮肤画廊
  .dsh/              # DSH 相关配置
  AGENTS.md          # 给 AI agent 的仓库说明（生态惯例）
```

两个值得抄的细节：

1. **统一 scope `@linxin666/*`**：所有包在同一 npm scope 下，peerDeps 契约一致（react、react-dom、`@deepseek-ai/dsh-*`）。
2. **仓库根部放 `AGENTS.md`**：DSH 生态的仓库默认是"Agent 可读"的——这既是给模型代理的开发说明，也是雷达扫描/其他 agent 评估你的插件的入口。写插件仓库时带上 AGENTS.md 是社区惯例。

## 三、单包解剖：dsh-remote-web-ui

选它解剖是因为结构最小而完整：host 侧 + 浏览器侧双面，且功能有故事性（手机扫码远程控制 DSH）。

### 三层结构

**第一层：声明层——插件怎么被 harness 认识**

`cordis.patch.yml` 全文件只有 4 行：

```yaml
- insert:
    - id: remote-web-ui
      name: '@linxin666/dsh-remote-web-ui'
```

`insert` 是 patch 指令族之一（还有 replace/remove/merge 等），作用是把 npm 包插入 profile 的插件清单。`package.json` 里对应声明：

```jsonc
{
  "name": "@linxin666/dsh-remote-web-ui",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-*"] }
  },
  "peerDependencies": { "@deepseek-ai/dsh-*": "...", "react": "...", "react-dom": "..." },
  "devDependencies": { "@deepseek-ai/cordis": "^4.0.1" }
}
```

关键认知：**`@deepseek-ai/cordis` 是 devDependency**——它只提供类型，不装进运行时。peerDeps 才是运行时契约。

**第二层：宿主层——cordis apply 风格插件**

```ts
import type { Context } from '@deepseek-ai/cordis'
import { z } from 'schemastery'

declare module '@deepseek-ai/cordis' {
  interface Events {
    'api/gate'(req: IncomingMessage): string | undefined | void  // waterfall 委派/否决
  }
}

export const name = 'remote-web-ui'
export const inject = ['webServer', 'apiProxy']   // 声明注入的服务
export function apply(ctx: Context, config?: Config): void { ... }
export const Config = z.object({ tokenTtl, offlineThreshold, ... })
```

**第三层：浏览器侧**——`client/` 目录，`dsh.client` 平台注入 `@deepseek-ai/dsh-client-*` 包，产物 `lib/client.js` 被 dsh 扫描进 web 插件清单。

### 内部 7 个模块各司其职

| 文件 | 职责 | 设计启示 |
|---|---|---|
| `index.ts` | apply 编排：merge 配置 → 构造服务 → 挂路由 → 挂事件 → settings → sync | 单一编排点，逻辑全外移 |
| `gate.ts` | `api/gate` waterfall 监听器 | **独立成文件**，便于测试复用 |
| `pairing.ts` | PairingService：token、设备会话、撤销 | 纯业务类，不碰 ctx |
| `tunnel.ts` | TunnelManager：Cloudflare quick tunnel 生命周期 | 外部资源管理器，dispose() 设计 |
| `routes.ts` | `/api/pair` 路由组 | 路由与 handler 分离 |
| `mobile-routes.ts` / `mobile-api.ts` | `/m` 页面 + `/m/api` 数据通道 | 移动端与桌面端分离 |
| `lan.ts` | LAN 地址推导（仅当绑定 0.0.0.0） | 环境感知工具 |

### 生命周期范式（抄这个就够）

```ts
// 事件监听：effect 包裹，随插件卸载自动移除
ctx.effect(() => ctx.on('api/gate', gate), 'remote-web-ui: api gate')
// 清理：effect 的 cleanup
ctx.effect(() => () => tunnel.dispose(), 'remote-web-ui: auto tunnel')
// 定时器：node:timers + unref()，不阻塞进程退出
const sweep = nodeSetInterval(...); sweep.unref()
// 可选注入判空：ctx.get('apiProxy') 可能 undefined
const apiProxy = ctx.get('apiProxy')
// 设置热更：installSettingsSection(ctx, NS, Config, config, { setSource, onChange })
// 热配置：保留可变 current，sync() 重读生效，无需重启
```

`api/gate` 是点睛之笔：它是一个 waterfall 事件，让连接插件对非回环 `/api` 请求**委派或否决**——这正是手机远程控制的权限 gate。教科书级 waterfall 用法，和官方教程里的 `approval/request`（策略代替用户作答）正好互为镜像。如果你写观察类监听器，记得 waterfall 纪律：**只观察必须调用 `next()`，否则静默吞掉下游默认行为**。

## 四、提炼：插件集范式（可直接复用）

1. **monorepo 打包**：pnpm workspaces + `packages/<plugin-name>` 独立可发布 + 聚合包 `-all` 一包装齐
2. **统一 scope**：`@scope/*`，peerDeps 契约清晰
3. **单插件三件套**：`cordis.patch.yml`（insert 声明）+ `package.json`（`dsh.bundle.patch`/`client`）+ `src/index.ts`（apply 入口）
4. **双面结构**：host 侧（routes/services/gate）+ 浏览器侧（`client/` 被 dsh.client 扫描）
5. **每包带 AGENTS.md + README + LICENSE**（社区惯例，利于扫描与收录）
6. **集成点选型**：webServer 路由 + waterfall 事件 + dsh.client 注入——这就是"给人类 UI"插件的标准路径

## 五、结论与下篇预告

dsh-web-ui 证明了两件事：**插件集形态是 DSH 生态的主流分发方式**；**单个插件包的结构已经高度模板化**——会了 dsh-remote-web-ui 的三层结构，你就掌握了社区绝大多数插件的骨架。

下一期预告：
- **第二篇**：深挖 dsh-remote-web-ui 的配对与隧道——QR 配对 token 怎么设计、cloudflared tunnel 生命周期怎么管理
- **第三篇**：实战——用这套范式写一个最小 `@dsh-external/*` 插件，走完"打 topic → 被雷达扫描收录"全流程

如果你也在做 DSH 插件，欢迎在评论区贴你的仓库，一起把生态的"运行时验证"空白填上——雷达数据显示：286 个插件只测了 5 个，0 个通过。缺口就是机会。

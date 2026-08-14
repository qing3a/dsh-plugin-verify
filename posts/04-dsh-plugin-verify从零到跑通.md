# 把方法论变成一条命令：dsh-plugin-verify 从零到跑通（四）

> 系列第四篇。前三篇讲了插件结构范式（一）、踩坑全记录（二）、无 API Key 验证方法论（三）。这篇讲**产品化**：方法论 → 一条命令 → 一个判定站的全过程——包括只属于"做工具"的坑。

---

## 一、缘起：方法论有了，但门槛太高

第三篇的方法论完整但繁琐：装 mock-llm → 装插件 → 跑 headless → 看 dump → 自己解析。**读者看完想验证自己的插件，得自己搭一套**——大多数人看完就关了。

生态当时的状态：awesome-dsh-plugins 雷达显示 286 个插件、运行时验证几乎空白。**验证方法有，验证工具没有。** 这就是 dsh-plugin-verify 的起点：把方法论变成一条命令。

```
npx dsh-plugin-verify <你的插件路径> --repo <DSH checkout>
✅ 通过 | 捕获事件: 13 | waterfall: 7/7 | tools/result: 是
```

## 二、核心架构决策：自包含审计器

最大的设计决策是**自包含**——CLI 自带一个迷你审计器（cordis 插件），不依赖任何已有插件：

```
dsh-plugin-verify/
├── src/cli.ts          # CLI 入口：5 步流程编排
├── auditor/            # 自包含审计器（独立 cordis 插件包）
│   ├── index.ts        # 监听 7 个 waterfall 事件 + tools/result
│   └── cordis.patch.yml
└── ...
```

**为什么自包含**：如果审计器依赖 dsh-event-auditor，插件作者装 CLI 还得先装另一个插件——门槛又回来了。自包含 = 装一条命令 = 什么都有了。

## 三、五步流程（复现方法论）

```
[1/5] 前置检查 DSH checkout（pnpm-workspace + 构建产物存在）
[2/5] 安装插件 + verify-auditor 到 headless profile（link:）
[3/5] 启动 mock-llm（node 直跑 bin.ts，tool_call_success → bash 调用）
[4/5] 跑 headless agent（auditor 监听 waterfall 链）
[5/5] 分析 dump：7/7 + tools/result = 零副作用判定
```

## 四、只属于"做工具"的坑（和插件坑完全不同）

第二篇记的是写插件踩的坑，这篇是**把流程封装成工具**才会遇到的：

### 坑 1：shell 引号地狱（Windows 专属）

```js
// ❌ shell:true 时参数被拼接，JSON 引号被 cmd 吃掉
spawn('pnpm', ['run', 'mock:llm', '--tool-arguments', '{"command":"ls"}'], { shell: true })
// → toolArguments must be valid JSON（引号没了）

// ✅ node 直跑 bin.ts，数组直传无拼接
spawn(process.execPath, ['--import', 'tsx', 'packages/test-support/llm-mock-server/src/bin.ts', ...])
```

**教训**：Windows 上 `shell:true` + 含引号的参数 = 定时炸弹。能用 `shell:false` 就别用 true。

### 坑 2：mock-llm 就绪竞态

```js
// ❌ 没等 ready 就跑 headless → TRANSPORT failed
void mock.ready
// ✅ 必须 await（30s 兜底）
await mock.ready
```

### 坑 3：dump 变量冲突

auditor 如果用 `DSH_EVENT_AUDIT_DUMP`，会跟 dsh-event-auditor 抢同一个环境变量 → 各自覆盖。**改用独立变量 `DSH_VERIFY_DUMP`。**

### 坑 4：失败插件残留阻塞后续验证

dsh-sentinel 验证失败后**永久 link 进 headless profile**——它声明了 webServer 必选注入，headless 没有 → 整个 profile 树 pending，**后面所有验证全被卡死**。

```js
// finally 里自清理目标插件 + auditor 自身
removePlugin(repoPath, pluginPath)
removeAuditor(repoPath)
```

### 坑 5：scope 改名漏改（最隐蔽）

把 `@dsh-external` 改成 `@qing3a` 时改了 package.json、patch、README——**漏了 auditor/cordis.patch.yml**。结果是：profile 里装的是新名，patch 声明的是旧名 → `Cannot find package '@dsh-external/verify-auditor'`。排查半天，根因是一行 patch。

**教训**：全局改名后 `grep -r 旧名` 必须零残留。

### 坑 6：node_modules 泄漏进发布包

`npm pack --dry-run` 发现 `auditor/node_modules/` 被打进 tarball（files 字段 `"auditor"` 递归了整个目录）。**发布前永远先 dry-run。**

### 坑 7：npm 2FA 发布

publish 被 403：账号开了 2FA，CLI 发布需要 **Granular Access Token with "Bypass 2FA"**。普通 token 没用。生成 token 时权限必须选 `Read and write with 2FA bypass`。

## 五、从工具到市场：定位演进

工具做出来只是第一步。真正的转折是**从"验证工具"变成"判定站"**——过程里有三个关键判断：

1. **不重复 awesome 的观测**：awesome-dsh-plugins 收录一切、六状态、明确"不判定、不背书、不是包管理器"——它把"哪个插件值得装"这个问题留白了。**我们做判定**（7/7 waterfall + tools/result = 零副作用）。
2. **功能全面对标 + 更直观**：awesome 有的（分类目录/状态体系/双角色手册/数据/边界）我们全有，且判定更严格（实测 vs 静态）、表现更直观（徽标颜色/数字卡片）。
3. **投稿系统仿 haidian**：城市设计征集（open-city-ai/haidian）的提交协议——SKILL.md 操作手册 + 提交包 + 确定性自检 gate + 路径所有权——完美适配 DSH 生态（插件作者很多就是 AI agent）。

```
skills/submission/SKILL.md     # agent 投稿手册（6 步流程）
scripts/check-submission.mjs   # 确定性 gate（结构/报告/哈希/分类/自检声明）
submissions/<owner>/<plugin>/  # 提交包（manifest + self_check + verify-report）
```

## 六、生态成果（截至 2026-08-14）

| 指标 | 数据 |
|---|---|
| 已验证插件 | 5（2 自有 + 3 外部：security-scan / balance / falsify-dsh） |
| 外部触达 Issue | 4（1 发现 bug + 3 通过） |
| 雷达收录 | 2 插件 MERGED（✅ 运行级） |
| npm 包 | 3 个发布（@qing3a/*） |
| 官方 Discussion | 方法论 462（含自荐 + 修正） |

**最有价值的案例**：验证 dsh-sentinel 时**发现真实 bug**（webServer 必选注入导致 headless 加载失败）——工具第一次用于外部就产出真成果，这是"判定站"可信度的第一块砖。

## 七、给后来者的清单

1. **自包含 > 依赖**：工具别依赖别的插件，装一条命令 = 全有
2. **发布前 dry-run**：`npm pack --dry-run` 查 tarball（node_modules 泄漏是经典坑）
3. **2FA 账号发布**：Granular Token + "Bypass 2FA" 权限
4. **全局改名后 grep 零残留**：patch/配置最容易漏
5. **失败资源必自清理**：否则污染共享环境，后续全崩
6. **判定要透明**：规则公开（7/7）、证据可复现（报告带 dump）、免责声明（徽标≠背书）——可信度是判定站的生命

---

*工具：github.com/qing3a/dsh-plugin-verify ｜ 系列四篇齐：结构范式 → 踩坑 → 验证方法论 → 产品化。*

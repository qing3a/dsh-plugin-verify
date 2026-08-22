---
name: dsh-plugin-verify-submission
description: Run runtime verification and the Verified DSH Plugins submission workflow for a DSH plugin.
whenToUse: Use when publishing, submitting, or revalidating a DSH plugin against a DSH checkout.
---

# DSH 插件投稿 Skill — 把插件上架到 Verified DSH Plugins

> 本 skill 描述如何把你的 DSH 插件提交到 [Verified DSH Plugins 目录](https://qing3a.github.io/dsh-plugin-verify/)。适合人类作者和 AI agent（Claude Code / Codex / DSH 自身）使用——按步骤执行即可完成投稿。
>
> **安装后注册到 DSH**：`npm install` 或 `npx` 只提供 CLI，不会自动把本 Skill 注册到 DSH。将本文件复制到 `${DSH_HOME:-$HOME/.dsh}/skills/dsh-plugin-verify-submission/SKILL.md`，然后刷新当前 Skill catalog 或启动新会话。不要用 `dsh plugin --profile web add` 安装本工具；它是验证 CLI，验证时才会临时装载 `verify-auditor`。

---

## 零、先注册到 DSH 用户 Skill

从本仓库 checkout 执行以下命令；如果使用已安装 npm 包，把源文件路径替换为该包目录下的 `skills/submission/SKILL.md`：

```bash
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
mkdir -p "$DSH_HOME/skills/dsh-plugin-verify-submission"
cp skills/submission/SKILL.md \
  "$DSH_HOME/skills/dsh-plugin-verify-submission/SKILL.md"
```

DSH 用户 Skill 必须位于 `$DSH_HOME/skills/<name>/SKILL.md`，并保留本文件开头的 `name`、`description` 和 `whenToUse` frontmatter。注册后刷新 Skill catalog 或启动新会话；这一步只注册 Agent Skill，不把 CLI 安装成 DSH 运行时插件。

## 一、这是什么

Verified DSH Plugins 是 DeepSeek Harness 插件的**判定站**：每个插件经过完整运行时验证（7/7 waterfall + tools/result）才收录。投稿 = 验证 + 上架 = 获得 ✅ Verified 徽标 + 被发现 + 被安装。

**收录前提（硬门槛）**：你的插件必须通过 [dsh-plugin-verify](https://github.com/qing3a/dsh-plugin-verify) 的运行时验证（`✅ 通过 | waterfall: 7/7 | tools/result: 是`），并声明符合[《DSH 插件开发与设计规范建议 v0.1》](https://github.com/qing3a/dsh-plugin-verify/blob/main/docs/plugin-standards.md)（基于官方源码分析与官方风格提炼，含入口/配置红线、生命周期、交互、验证、发布约定）。

## 二、参与流程（6 步）

1. **确认资格**：插件仓库公开、打 `dsh-plugin` topic、package.json 合法（name/入口/运行时依赖/许可证）
2. **跑验证**：`npx dsh-plugin-verify <你的插件路径> --repo <DSH checkout>`
3. **收集报告**：记录 `verify-report.json` 的完整内容
4. **生成提交包**：按下方模板创建 `submissions/<owner>/<plugin>/` 下三个文件
5. **跑自检**：`node scripts/check-submission.mjs submissions/<owner>/<plugin>`
6. **提 PR**：只修改 `submissions/<owner>/<plugin>/` 路径，附验证报告与分类说明

## 三、提交包模板

### submissions/<owner>/<plugin>/manifest.json

```json
{
  "schema": "dsh-plugin-submission/v1",
  "plugin": {
    "name": "@scope/plugin-name",
    "repo": "owner/repo",
    "category": "调试与观测",
    "description": "一句话说明",
    "version": "0.1.0"
  },
  "verification": {
    "report": "verify-report.json",
    "date": "2026-08-14",
    "pass": true
  },
  "files": {
    "verify-report.json": "<sha256>",
    "self_check.json": "<sha256>"
  }
}
```

> ⚠️ `files` 只列**外部证据文件**（verify-report / self_check）的 SHA-256。`manifest.json` 自身不参与哈希（它含自己的哈希会循环依赖）——manifest 完整性由自检脚本的字段校验保证。

### submissions/<owner>/<plugin>/self_check.json

```json
{
  "schema": "dsh-plugin-submission/v1",
  "checks": {
    "repo_public": true,
    "topic_dsh_plugin": true,
    "package_json_valid": true,
    "deps_declared": true,
    "license_present": true,
    "readme_complete": true,
    "verification_passed": true
  }
}
```

### submissions/<owner>/<plugin>/verify-report.json

`npx dsh-plugin-verify` 的完整输出（pass 必须为 true）。

## 四、分类表（category 必填其一）

| 分类 | 说明 |
|---|---|
| 调试与观测 | 事件审计、会话诊断、运行观测 |
| 桌面与系统 | 托盘驻留、桌面外壳、原生能力桥接 |
| 安全与合规 | 密钥扫描、危险模式检测、合规工具 |
| 效率与监控 | Token 消耗、账户余额、运行指标 |
| 编码开发 | 代码操作、git 集成、终端、文档生成 |
| 通讯集成 | 消息推送、机器人、跨工具桥接 |
| 娱乐生活 | 游戏、皮肤、趣味功能 |

## 五、自检 gate（提交前必跑）

```bash
node scripts/check-submission.mjs submissions/<owner>/<plugin>
# ✅ 通过 → 可提交 PR
# ❌ blocking → 按提示修复（见输出）
```

**Blocking 项**：结构不完整 / verify-report 非 pass / manifest 必填缺失 / category 不在分类表 / 哈希不匹配 / self_check 未全 true。

## 六、PR 规范

- **路径所有权**：只改 `submissions/<owner>/<plugin>/`，不改别人的投稿、不动 index.html/README
- **PR 标题**：`submission: <plugin-name>`
- **PR 内容**：附验证摘要（`✅ 通过 | waterfall: 7/7`）+ 分类 + 一句话描述
- 合并后你的插件进入分类目录并获 ✅ 徽标

## 七、纪律（对 AI agent 特别重要）

- 验证未通过**不要投稿**——修复后重跑再投
- 投稿包哈希与文件必须一致——手改 manifest 会被 gate 拒绝
- 不要在 PR 里夹带无关改动
- 有问题先跑自检，再开 issue 问

## 八、常见问题

- **验证失败（❌ 未通过）**：读 `verify-report.json` 的 `waterfallMissing`，定位插件哪个 waterfall 监听器有问题（漏调 next() 是常见原因），修复后重跑
- **headless 加载失败**：检查 `inject` 是否含 webServer 等 headless 缺失服务——用 `ctx.inject` 动态注入（参考 [dsh-sentinel 案例](https://github.com/fuhefei/dsh-sentinel/issues/4)）
- **分类拿不准**：选最接近的；维护者复核时可调整

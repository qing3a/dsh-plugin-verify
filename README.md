# dsh-plugin-verify

验证 DSH（DeepSeek Harness）插件的 CLI：一条命令跑 mock-llm 完整 agent 循环，检查 waterfall 链完整性与零副作用，产出验证报告。

**生态空白**：DSH 插件的运行时验证几乎空白（[awesome-dsh-plugins](https://github.com/AdamPlatin123/awesome-dsh-plugins) 雷达的运行时测试层覆盖极低）——本工具把「运行时验证」从方法论变成一条命令。

## 它验证什么

用 mock-llm 触发真实 agent 循环（`tool_call_success` → bash 工具调用），检查整条 waterfall 链：

```
system-prompt/assemble → agent/pre-step → agent/request → llm/stream
→ tools/pre-execute → tools/execute → tools/post-execute → tools/result
```

**通过标准**：7/7 waterfall 链完整出现 + `tools/result` 收尾 = 插件零副作用（waterfall 监听器正确透传 `next()`）。

## 使用

```bash
# 前提：DSH 源码 checkout 已构建（build:lib:host + build:lib:client）
npx dsh-plugin-verify <你的插件路径> --repo <DSH checkout> [--out <报告目录>]
```

示例：

```bash
npx dsh-plugin-verify ~/my-dsh-plugin --repo ~/deepseek-harness
# [1/5] 前置检查 ...
# [5/5] 分析事件审计
# ✅ 通过 | 捕获事件: 13 | waterfall: 7/7 | tools/result: 是
# 报告: ./verify-report.json
```

退出码：`0` 通过 / `1` 未通过 / `2` 环境错误。

## 验证报告

`verify-report.json` 含：插件/DSH 路径、日期、pass、waterfall 链明细、detail。可直接作为 awesome-dsh-plugins 登记 PR 的「运行时验证证据」。

## Verified DSH Plugins 目录

验证通过的真实插件收录于：**[index.html](index.html)**（GitHub Pages 托管）。

## 文章

- [从零拆解 DSH 插件集（一）：dsh-web-ui 全景与插件集范式](posts/01-dsh-web-ui-拆解.md)
- [从零写一个 DSH 插件并跑通：踩坑全记录（二）](posts/02-从零写DSH插件踩坑全记录.md)
- [无 API Key 验证 DSH 插件：mock-llm 实战与 waterfall 捕获实证（三）](posts/03-无APIKey验证DSH插件.md)

## 原理

- **自包含**：CLI 自带迷你审计器 `auditor/`（cordis 插件），经 `dsh plugin add link:` 注入 headless profile，不依赖任何其他插件
- **mock-llm**：DSH 仓库自带的脚本化 LLM 服务器（`--sequence tool_call_success,success`），无需真实 API key
- **headless**：无 UI 的 agent 循环，waterfall 事件在真实运行中可观测
- **dump**：`DSH_VERIFY_DUMP` 环境变量导出事件记录（独立变量，避免与 dsh-event-auditor 冲突）

## 开发

```bash
pnpm install
pnpm build                # CLI（src/）
cd auditor && pnpm install && npx tsc -p tsconfig.json   # 审计器
```

## 许可

MIT

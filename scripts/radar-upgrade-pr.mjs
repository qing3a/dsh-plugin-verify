// Upgrade runtime status of verified plugins in PLUGINS.md (待测 → ✅) via gh api.
// Usage: node radar-upgrade-pr.mjs
// 已在表且判定站已发 ✅（有 verify-report）：security-scan / balance / falsify-dsh / genui。
// 不在 PLUGINS.md 表的（dsh-at-file / modlens）脚本会 SKIP——需 awesome 目录先收录。
// dsh-sentinel / dsh-automation / DSH-better-sidebar: stays 待测 (web 环境依赖，headless 无法激活)
import { execFileSync } from 'node:child_process'

const OWNER = 'AdamPlatin123'
const REPO = 'awesome-dsh-plugins'
const FORK = 'qing3a/awesome-dsh-plugins'
const BRANCH = 'docs/upgrade-verified-status'
const PLUGINS_PATH = 'PLUGINS.md'

const UPGRADES = {
  'dsh-security-scan': '✅',
  'dsh-balance': '✅',
  'falsify-dsh': '✅',
  'dsh-genui': '✅',
}

function gh(args, input) {
  const opts = input === undefined ? { encoding: 'utf8' } : { input: JSON.stringify(input), encoding: 'utf8' }
  const full = input === undefined ? args : [...args, '--input', '-']
  return execFileSync('gh', ['api', ...full], opts)
}

// 1. fork main sha
const forkRef = JSON.parse(gh([`repos/${FORK}/git/ref/heads/main`]))
const baseSha = forkRef.object.sha
console.log('fork main sha:', baseSha.slice(0, 7))

// 2. branch
try { gh([`repos/${FORK}/git/refs/heads/${BRANCH}`, '--method', 'DELETE']) } catch {}
gh([`repos/${FORK}/git/refs`, '--method', 'POST'], { ref: `refs/heads/${BRANCH}`, sha: baseSha })
console.log('branch created:', BRANCH)

// 3. read current PLUGINS.md
const current = JSON.parse(gh([`repos/${FORK}/contents/${PLUGINS_PATH}?ref=${BRANCH}`]))
let content = Buffer.from(current.content, 'base64').toString('utf8')

// 4. upgrade statuses: "| <plugin> | ... | 待测 |" → "| <plugin> | ... | ✅ |"
let changed = 0
for (const [name, status] of Object.entries(UPGRADES)) {
  const re = new RegExp(`^(\\|[ ]*${name}[ ]*\\|.*\\| )[ ]*待测[ ]*\\|`, 'm')
  if (re.test(content)) {
    content = content.replace(re, `$1${status} |`)
    changed++
    console.log(`upgraded: ${name} → ${status}`)
  } else {
    console.log(`SKIP (row not 待测 or missing): ${name}`)
  }
}
if (changed === 0) { console.log('nothing to change'); process.exit(0) }

gh([`repos/${FORK}/contents/${PLUGINS_PATH}`, '--method', 'PUT'], {
  message: `docs: 升级已验证插件运行级（${Object.keys(UPGRADES).join(', ')} → ✅）`,
  content: Buffer.from(content, 'utf8').toString('base64'),
  sha: current.sha,
  branch: BRANCH,
})
console.log('PLUGINS.md updated')

// 5. PR
const body = `## 变更

将以下插件的运行级从「待测」升级为「✅」——依据 [dsh-plugin-verify](https://github.com/qing3a/dsh-plugin-verify) 的运行时验证（7/7 waterfall + tools/result）：

| 插件 | 升级 | 证据 |
|---|---|---|
| dsh-security-scan | 待测 → ✅ | [verify-report](https://github.com/qing3a/dsh-plugin-verify/blob/main/reports/security-scan-2026-08-14.json) · [验证 issue](https://github.com/ben7am1n/dsh-security-scan/issues/1) |
| dsh-balance | 待测 → ✅ | [verify-report](https://github.com/qing3a/dsh-plugin-verify/blob/main/reports/balance-2026-08-14.json) · [验证 issue](https://github.com/TwotwoPiggy/dsh-balance/issues/2) |
| falsify-dsh | 待测 → ✅ | [verify-report](https://github.com/qing3a/dsh-plugin-verify/blob/main/reports/falsify-2026-08-14.json) |
| dsh-genui | 待测 → ✅ | [verify-report](https://github.com/qing3a/dsh-plugin-verify/blob/main/reports/genui-2026-08-15.json) |

## 说明

- dsh-sentinel **未升级**：headless 下因 \`inject: ['webServer']\` 必选注入导致加载失败（[issue #4](https://github.com/fuhefei/dsh-sentinel/issues/4)）——保持待测，不误标。
- dsh-automation / DSH-better-sidebar 亦为 web 环境依赖（inject storageDomain/connection / webServer/webRuntime），headless 判定模式无法激活，**未升级**，保持待测，不误标。
- dsh-at-file / ModLens 判定站已验证（[at-file](https://github.com/qing3a/dsh-plugin-verify/blob/main/reports/at-file-2026-08-15.json) · [modlens](https://github.com/qing3a/dsh-plugin-verify/blob/main/reports/modlens-2026-08-15.json)）但未在 PLUGINS.md 收录——需本目录先收录，本 PR 仅升级已在表条目。
- 验证方法：mock-llm 触发完整 agent 循环，检查 waterfall 链完整 + agent 正常收尾（零副作用）。方法论见 [Discussion 462](https://github.com/deepseek-ai/deepseek-harness/discussions/462)。
- 本次仅改状态列，不动其他内容。
`
const pr = JSON.parse(gh([`repos/${OWNER}/${REPO}/pulls`, '--method', 'POST'], {
  title: 'docs: 升级已验证插件运行级（security-scan、balance、falsify-dsh、genui → ✅）',
  head: `qing3a:${BRANCH}`,
  base: 'main',
  body,
}))
console.log('PR created:', pr.html_url)

/**
 * static-rules.mjs — dsh-plugin-verify 确定性静态规则（机器 gate，无依赖）。
 *
 * 规则来源：官方 postmortem（docs/postmortem/，deepseek-harness mainline 2026-08-14）：
 *  - R1 入口形态（postmortem 0001）：插件若用 namespace 形式（name/inject/Config/apply
 *    命名导出），不得同时 `export default`——Loader.unwrapExports 优先取 `.default`，
 *    会丢弃 namespace 兄弟导出，导致 inject 丢失、加载期崩溃。
 *  - R2 patch YAML（postmortem 0002）：`!!js` 表达式只在插件 `config` 子树下求值；
 *    entry metadata（disabled 等）出现表达式对象 = truthy 对象 → 条件配置被静默禁用。
 *    官方 guardrail 是 verify-cordis-config 拒绝 entry metadata 中的表达式节点。
 *
 * 实现为纯文本确定性扫描（无 yaml/ast 依赖）：R1 逐行词法检查入口源码，
 * R2 用缩进推断字段路径判断 `!!js` 是否位于 config 子树。属于"确定性静态信号"，
 * 不是语义分析——文档声明边界，最终以运行时验证（7/7 waterfall）为准。
 *
 * 用法：node scripts/static-rules.mjs <插件目录>
 * 退出码：0=静态规则全过  1=有规则不通过  2=用法/环境错误
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const NS_EXPORTS = ['name', 'inject', 'Config', 'apply']

/** 去掉单行注释与（跨行）块注释后的代码行；块注释需状态机，行级正则漏中间行 */
function stripComments(line, inBlock) {
  let s = line
  let state = inBlock
  if (state) {
    // 在块注释内：找本行的 */ 结束点；之前的内容全是注释
    const end = s.indexOf('*/')
    if (end >= 0) {
      state = false
      s = s.slice(end + 2)
    } else {
      return { code: '', state: true }
    }
  }
  const start = s.indexOf('/*')
  if (start >= 0) {
    const end = s.indexOf('*/', start + 2)
    if (end >= 0) {
      s = s.slice(0, start) + s.slice(end + 2)
    } else {
      s = s.slice(0, start)
      state = true
    }
  }
  s = s.replace(/\/\/.*$/, '')
  return { code: s, state }
}

/** 收集入口文件的命名导出与 default 目标（行级词法，非 AST） */
function scanEntry(source) {
  const named = new Set()
  let defaultTarget = null // 'bare-fn' | 'object' | 'identifier:xxx' | 'none'
  let inBlock = false
  for (const raw of source.split('\n')) {
    const { code: s, state } = stripComments(raw, inBlock)
    inBlock = state
    if (/\bexport\s+default\b/.test(s)) {
      const rest = s.replace(/\bexport\s+default\b/, '')
      if (/^\s*apply\s*$/.test(rest) || /^\s*apply\b/.test(rest)) defaultTarget = 'bare-fn'
      else if (rest.includes('{')) defaultTarget = 'object'
      else defaultTarget = 'identifier'
    }
    for (const n of NS_EXPORTS) {
      if (new RegExp(`\\bexport\\s+(const|function)\\s+${n}\\b`).test(s)) named.add(n)
    }
  }
  return { named, defaultTarget }
}

/** R1：入口形态检查。namespace 形式 + export default = 危险（0001） */
function ruleEntry(pluginDir) {
  const pkgPath = join(pluginDir, 'package.json')
  if (!existsSync(pkgPath)) return { pass: false, detail: '缺 package.json' }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const main = pkg.main
  if (typeof main !== 'string') {
    return { pass: false, detail: 'package.json 未声明 main（无法定位入口做静态检查）' }
  }
  // main 指向 lib 产物时也查 src 原文（产物多为 bundle，词法不可靠）
  const candidates = [join(pluginDir, main)]
  const srcFallback = join(pluginDir, 'src', 'index.ts')
  if (existsSync(srcFallback) && !candidates.some((c) => existsSync(c))) candidates.push(srcFallback)
  const entry = candidates.find((c) => existsSync(c))
  if (!entry) return { pass: false, detail: `入口不存在: ${main}` }

  const { named, defaultTarget } = scanEntry(readFileSync(entry, 'utf8'))
  const isNamespace = named.has('name') && named.has('apply')
  if (!isNamespace) {
    return {
      pass: true,
      detail: `入口 ${entry}：未见 namespace 形式（name+apply），静态形态检查不适用（default=${defaultTarget}）`,
    }
  }
  if (defaultTarget === 'bare-fn' || defaultTarget === 'identifier') {
    return {
      pass: false,
      detail: `入口 ${entry}：namespace 形式（含 name/inject/Config/apply）同时 export default——unwrapExports 优先取 default，inject 会丢（postmortem 0001）。删除 export default，或用 export default { name, inject, Config, apply }`,
    }
  }
  return { pass: true, detail: `入口 ${entry}：namespace 形式 ✓ 且无裸 export default` }
}

/** 用缩进推断 `!!js` 表达式位于哪个字段路径（config 子树=合法，entry metadata=违规） */
function expressionPath(lines, idx) {
  const path = []
  let lastIndent = Infinity
  for (let i = idx; i >= 0; i--) {
    const m = lines[i].match(/^(\s*)([A-Za-z0-9_-]+):/)
    if (!m) continue
    const indent = m[1].length
    const key = m[2]
    if (indent < lastIndent) {
      path.unshift(key)
      lastIndent = indent
    } else if (indent === lastIndent) {
      path[path.length - 1] = key
    }
    if (indent === 0) break // 到文档顶层
  }
  return path
}

/** R2：patch YAML 检查。`!!js` 只允许在 config 子树（0002） */
function rulePatch(pluginDir) {
  const pkgPath = join(pluginDir, 'package.json')
  if (!existsSync(pkgPath)) return { pass: false, detail: '缺 package.json' }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const patch = pkg.dsh?.bundle?.patch
  if (typeof patch !== 'string') {
    return { pass: true, detail: '无 dsh.bundle.patch（工具型插件，静态 YAML 规则不适用）' }
  }
  const patchFile = join(pluginDir, patch)
  if (!existsSync(patchFile)) return { pass: false, detail: `dsh.bundle.patch 指向不存在: ${patch}` }

  const lines = readFileSync(patchFile, 'utf8').split('\n')
  const violations = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('!!js')) continue
    const path = expressionPath(lines, i)
    if (!path.includes('config')) {
      violations.push(`第 ${i + 1} 行 !!js 位于 entry metadata 字段（${path.join('.') || '(顶层)'}）——该位置不插值，表达式对象为 truthy 会被静默启用/禁用（postmortem 0002）`)
    }
  }
  if (violations.length > 0) {
    return { pass: false, detail: `patch ${patch}：${violations.length} 处违规；${violations[0]}` }
  }
  return { pass: true, detail: `patch ${patch}：!!js 表达式均位于 config 子树（${lines.length} 行）` }
}

export function runStaticRules(pluginDir) {
  const abs = resolve(pluginDir)
  const rules = [
    { name: 'R1-entry-shape', ...ruleEntry(abs) },
    { name: 'R2-patch-yaml', ...rulePatch(abs) },
  ]
  return {
    rules,
    pass: rules.every((r) => r.pass),
    detail: rules.map((r) => `${r.pass ? '✓' : '✗'} ${r.name}`).join(' '),
  }
}

// CLI 入口（被 src/cli.ts spawn 调用时走这里）
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (isMain) {
  try {
    const target = process.argv[2]
    if (!target) {
      console.error('用法: node scripts/static-rules.mjs <插件目录>')
      process.exit(2)
    }
    const result = runStaticRules(target)
    for (const r of result.rules) {
      console.log(`${r.pass ? '✓' : '✗'} ${r.name}: ${r.detail}`)
    }
    console.log(result.pass ? '静态规则：全过' : '静态规则：有违规')
    process.exit(result.pass ? 0 : 1)
  } catch (err) {
    console.error(`✗ 静态规则执行失败: ${err.message}`)
    process.exit(2)
  }
}

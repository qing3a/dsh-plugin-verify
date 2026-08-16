#!/usr/bin/env node
/**
 * 生成 verified.json —— 判定站对外开放的运行时验证数据层
 *
 * 从 reports/*.json 聚合所有 pass=true 的验证，输出开放数据层，
 * 供任何插件市场/清单引用（互操作字段 verifiedBy/verifiedAt/reportUrl）。
 *
 * 用法: node scripts/generate-verified.mjs
 * 产物: verified.json（仓库根，公开可引用）
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const reportsDir = join(root, 'reports')
/** 校验器版本（与 CLI 报告 verifiedBy 对齐，读 package.json 避免硬编码漂移） */
const VER = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')).version ?? '0'
const VERIFIER = `dsh-plugin-verify@${VER}`
const REPORT_BASE = 'https://github.com/qing3a/dsh-plugin-verify/blob/main/reports/'

/** 报告文件名(去日期后缀) → GitHub 仓库 URL 映射 */
const REPO_MAP = {
  'event-auditor': 'https://github.com/qing3a/dsh-event-auditor',
  'tray': 'https://github.com/qing3a/dsh-tray',
  'security-scan': 'https://github.com/ben7am1n/dsh-security-scan',
  'balance': 'https://github.com/TwotwoPiggy/dsh-balance',
  'repo-context': 'https://github.com/qing3a/dsh-repo-context',
  'falsify': 'https://github.com/shi275773124/falsify-dsh',
  'at-file': 'https://github.com/omdsh-dev/dsh-at-file',
  'genui': 'https://github.com/omdsh-dev/dsh-genui',
  'modlens': 'https://github.com/liustack/modlens',
  'sentinel': 'https://github.com/fuhefei/dsh-sentinel',
  'navbar': 'https://github.com/vlln/dsh-navbar',
  'notification': 'https://github.com/omdsh-dev/dsh-notification',
  'modsearch': 'https://github.com/liustack/modsearch',
  'memory-evolve': 'https://github.com/csyangwen/dsh-memory-evolve',
}

/** 插件显示名（报告文件名前缀 → 插件名） */
const NAME_MAP = {
  'event-auditor': 'dsh-event-auditor',
  'tray': 'dsh-tray',
  'security-scan': 'dsh-security-scan',
  'balance': 'dsh-balance',
  'repo-context': 'dsh-repo-context',
  'falsify': 'falsify-dsh',
  'at-file': 'dsh-at-file',
  'genui': 'dsh-genui',
  'modlens': 'ModLens',
  'sentinel': 'dsh-sentinel',
  'navbar': 'dsh-navbar',
  'notification': 'dsh-notification',
  'modsearch': 'modsearch',
  'memory-evolve': 'dsh-memory-evolve',
}

const files = readdirSync(reportsDir).filter((f) => f.endsWith('.json') && !f.startsWith('.'))
const entries = []

/** 回填旧报告：补契约字段（fullName/verifiedBy/schemaVersion/reportUrl/security），幂等（key 已存在不覆盖）。
 * security 的 null 是合法值（未评估），也要写入——判断只看 key 是否存在，不看值。 */
function backfill(report, patch) {
  let changed = false
  for (const [k, v] of Object.entries(patch)) {
    if (report[k] === undefined) {
      report[k] = v
      changed = true
    }
  }
  return changed
}

for (const f of files) {
  const filePath = join(reportsDir, f)
  const report = JSON.parse(readFileSync(filePath, 'utf-8'))
  if (!report.pass) continue

  // 文件名形如 modsearch-2026-08-16.json → 取 '-' 前前缀匹配映射
  const key = f.replace(/-\d{4}-\d{2}-\d{2}\.json$/, '')
  // 规范映射键优先读报告内 fullName；旧报告从 REPO_MAP 推导（owner/name）
  const repoUrl = report.fullName ? `https://github.com/${report.fullName}` : REPO_MAP[key]
  const fullName = report.fullName ?? (repoUrl ? repoUrl.replace('https://github.com/', '') : null)
  const name = NAME_MAP[key] ?? key
  // 验证日期以报告文件名为准（归档时用本地日期命名，比 report.date 的 UTC 更准确）
  const date = f.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? (report.date || '').slice(0, 10)
  const reportUrl = `${REPORT_BASE}${f}`

  // 回填报告契约字段（CLI 新产物自带，旧产物补齐）
  const security = report.security ?? extractSecurity(report)
  if (backfill(report, { fullName, verifiedBy: VERIFIER, schemaVersion: 1, reportUrl, security })) {
    writeFileSync(filePath, JSON.stringify(report, null, 2) + '\n')
  }

  entries.push({
    name,
    repo: repoUrl ?? null,
    verifiedBy: report.verifiedBy ?? 'dsh-plugin-verify',
    verifiedAt: date,
    reportUrl,
    waterfall: `${report.waterfallFound.length}/7`,
    toolsResult: report.detail?.includes('tools/result: 是') ?? false,
    security,
  })
}

/**
 * 安全维度：提取报告中的静态安全规则结果（P202 裸 spawn / P401 single 槽）。
 * 报告未含这些规则（旧 CLI 产物）→ null（未评估），不误报 "OK"。
 */
function extractSecurity(report) {
  const secRules = (report.rules || []).filter((r) => r.name?.startsWith('P202') || r.name?.startsWith('P401'))
  if (secRules.length === 0) return null
  const warnings = secRules
    .filter((r) => r.warn)
    .map((r) => ({ rule: r.name, detail: (r.detail || '').slice(0, 160) }))
  return {
    status: warnings.length === 0 ? 'clean' : 'warnings',
    warnings,
  }
}

// 排序：按验证日期升序（最早在前，稳定输出）
entries.sort((a, b) => a.verifiedAt.localeCompare(b.verifiedAt))

const out = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  description: 'DSH 插件运行时验证开放数据层（dsh-plugin-verify 判定站产出）',
  verifiedBy: VERIFIER,
  reportBaseUrl: REPORT_BASE,
  plugins: entries,
}

writeFileSync(join(root, 'verified.json'), JSON.stringify(out, null, 2) + '\n')
console.log(`✅ verified.json 生成：${entries.length} 个已验证插件`)
for (const e of entries) console.log(`  ${e.name.padEnd(20)} ${e.verifiedAt}  ${e.waterfall}  ${e.repo}`)

#!/usr/bin/env node
/**
 * check-submission — DSH 插件投稿确定性自检 gate（仿 haidian self_check_submission.py）。
 *
 * 用法：node scripts/check-submission.mjs submissions/<owner>/<plugin>
 * 退出码：0 = 通过（可提交 PR）；1 = blocking（必须修复）；2 = 用法错误
 *
 * Blocking 检查：
 *  - 投稿目录结构完整（manifest / self_check / verify-report）
 *  - verify-report.json pass === true
 *  - manifest 必填字段齐全 + category 在分类表内
 *  - 文件 SHA-256 与 manifest.files 一致（防手改）
 *  - self_check.json 各项全 true
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const KNOWN_CATEGORIES = [
  '调试与观测',
  '桌面与系统',
  '安全与合规',
  '效率与监控',
  '编码开发',
  '通讯集成',
  '娱乐生活',
]

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function check(ok, msg) {
  const status = ok ? '✅' : '❌ blocking'
  console.log(`${status} ${msg}`)
  return ok
}

function main() {
  const target = process.argv[2]
  if (!target) {
    console.error('用法: node scripts/check-submission.mjs submissions/<owner>/<plugin>')
    process.exit(2)
  }
  const dir = resolve(target)
  let blocked = false

  console.log(`检查投稿包: ${dir}\n`)

  // 1. 结构完整
  const manifestPath = join(dir, 'manifest.json')
  const selfCheckPath = join(dir, 'self_check.json')
  const reportPath = join(dir, 'verify-report.json')
  for (const [name, p] of [['manifest.json', manifestPath], ['self_check.json', selfCheckPath], ['verify-report.json', reportPath]]) {
    if (!check(existsSync(p), `${name} 存在`)) blocked = true
  }
  if (blocked) {
    console.log('\n结果: ❌ blocking（结构不完整）')
    process.exit(1)
  }

  // 2. verify-report pass === true
  let report
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'))
  } catch {
    console.log('❌ blocking verify-report.json 不是合法 JSON')
    process.exit(1)
  }
  if (!check(report.pass === true, `verify-report pass === true（实际: ${String(report.pass)}）`)) blocked = true
  if (!check(Array.isArray(report.waterfallMissing) && report.waterfallMissing.length === 0, 'waterfallMissing 为空（7/7 完整）')) blocked = true

  // 3. manifest 必填字段
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    console.log('❌ blocking manifest.json 不是合法 JSON')
    process.exit(1)
  }
  const required = [
    ['schema', manifest.schema],
    ['plugin.name', manifest.plugin?.name],
    ['plugin.repo', manifest.plugin?.repo],
    ['plugin.category', manifest.plugin?.category],
    ['plugin.description', manifest.plugin?.description],
    ['plugin.version', manifest.plugin?.version],
    ['verification.date', manifest.verification?.date],
  ]
  for (const [field, val] of required) {
    if (!check(val !== undefined && val !== '', `manifest.${field} 存在`)) blocked = true
  }
  if (!check(KNOWN_CATEGORIES.includes(manifest.plugin?.category), `category 在分类表内（${manifest.plugin?.category ?? '?'}）`)) blocked = true
  if (!check(manifest.verification?.pass === true, 'manifest.verification.pass === true')) blocked = true

  // 4. 文件哈希一致（防手改）。
  // ⚠️ manifest.json 自身不参与哈希：它包含自己的 SHA-256 → 循环依赖。
  //     manifest 的完整性由上面的字段校验保证；哈希只约束外部证据文件。
  const fileList = manifest.files
  if (!check(typeof fileList === 'object' && fileList !== null, 'manifest.files 存在')) {
    blocked = true
  } else {
    for (const [fname, expectedSha] of Object.entries(fileList)) {
      if (fname === 'manifest.json') continue // 自引用跳过（见上）
      const fpath = join(dir, fname)
      if (existsSync(fpath)) {
        const actual = sha256(fpath)
        if (!check(actual === expectedSha, `${fname} SHA-256 一致`)) blocked = true
      } else if (!check(false, `${fname} 存在（manifest 声明但缺失）`)) {
        blocked = true
      }
    }
  }

  // 5. self_check 全 true
  let selfCheck
  try {
    selfCheck = JSON.parse(readFileSync(selfCheckPath, 'utf8'))
  } catch {
    console.log('❌ blocking self_check.json 不是合法 JSON')
    process.exit(1)
  }
  const checks = selfCheck.checks
  if (!check(typeof checks === 'object' && checks !== null, 'self_check.checks 存在')) {
    blocked = true
  } else {
    for (const [name, val] of Object.entries(checks)) {
      if (!check(val === true, `self_check.${name} === true`)) blocked = true
    }
  }

  console.log(`\n结果: ${blocked ? '❌ blocking — 修复后重跑' : '✅ 通过 — 可提交 PR'}`)
  process.exit(blocked ? 1 : 0)
}

main()

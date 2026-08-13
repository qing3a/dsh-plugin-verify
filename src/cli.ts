/**
 * dsh-plugin-verify — CLI 入口。
 * 验证流程（封装 2026-08-14 已实证的方法论）：
 *  1. 定位 DSH checkout（--repo 或 DSH_REPO 环境变量）
 *  2. 把待验证插件 link 进 headless profile
 *  3. 启动 mock-llm（tool_call_success 触发工具调用）
 *  4. 用 --patch 注入 verify-auditor + DSH_EVENT_AUDIT_DUMP 跑 headless agent
 *  5. 解析 dump：检查 waterfall 链完整 + agent 收尾（零副作用证明）
 *  6. 输出报告（JSON + 人类可读），退出码 0=通过 1=未通过 2=环境错误
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = resolve(fileURLToPath(new URL('.', import.meta.url)))

/** 验证所需的 waterfall 链（与 auditor/ 内定义一致，此处为 CLI 解析用） */
const WATERFALL_CHAIN: ReadonlyArray<readonly [string, string]> = [
  ['system-prompt/assemble', 'waterfall'],
  ['agent/pre-step', 'waterfall'],
  ['agent/request', 'waterfall'],
  ['llm/stream', 'waterfall'],
  ['tools/pre-execute', 'waterfall'],
  ['tools/execute', 'waterfall'],
  ['tools/post-execute', 'waterfall'],
]

interface CliArgs {
  pluginPath: string
  repoPath: string
  outDir: string
  dumpPath: string
  verbose: boolean
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args = [...argv]
  let pluginPath = ''
  let repoPath = process.env.DSH_REPO ?? ''
  let outDir = process.cwd()
  let verbose = false

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--repo') {
      repoPath = args[++i] ?? ''
    } else if (a === '--out') {
      outDir = args[++i] ?? ''
    } else if (a === '--verbose') {
      verbose = true
    } else if (!a.startsWith('-')) {
      pluginPath = a
    }
  }

  if (!pluginPath) {
    throw new Error('用法: dsh-plugin-verify <插件路径或git URL> [--repo <DSH checkout路径>] [--out <报告目录>]')
  }
  if (!repoPath) {
    throw new Error('未指定 DSH checkout：用 --repo 或 DSH_REPO 环境变量')
  }
  return { pluginPath, repoPath, outDir, dumpPath: join(outDir, 'verify-dump.json'), verbose }
}

function run(cmd: string, args: string[], opts: { cwd?: string; env?: Record<string, string>; timeoutMs?: number } = {}): { code: number; stdout: string } {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    encoding: 'utf8',
    timeout: opts.timeoutMs ?? 120_000,
    shell: process.platform === 'win32',
  })
  return { code: res.status ?? 1, stdout: res.stdout ?? '' }
}

/** 前置检查：DSH checkout 存在 + pnpm 可用 + host lib 已构建 */
function preflight(repoPath: string): void {
  if (!existsSync(join(repoPath, 'pnpm-workspace.yaml'))) {
    throw new Error(`不是 DSH checkout: ${repoPath}（缺 pnpm-workspace.yaml）`)
  }
  const typecheck = run('pnpm', ['--version'], { cwd: repoPath })
  if (typecheck.code !== 0) {
    throw new Error('pnpm 不可用（需要 pnpm，DSH 锁定 11.7.0，先 corepack enable）')
  }
  const needsBuild = [
    'packages/boot/app-boot/lib/index.js',
    'packages/interaction/commands/lib/typert.host.js',
  ].some((rel) => !existsSync(join(repoPath, rel)))
  if (needsBuild) {
    throw new Error('DSH 尚未构建：请先运行 pnpm run build:lib:host && pnpm run build:lib:client')
  }
}

/** 把插件/auditor link 进 headless profile（dsh.bundle 声明的包自动成为 layer） */
function installPlugin(repoPath: string, target: string, label: string): void {
  const abs = resolve(target)
  if (!existsSync(join(abs, 'package.json'))) {
    throw new Error(`${label}路径无效（缺 package.json）: ${abs}`)
  }
  const res = run('pnpm', ['dsh', 'plugin', '--profile', 'headless', 'add', `link:${abs}`], {
    cwd: repoPath,
    timeoutMs: 180_000,
  })
  if (res.code !== 0) {
    throw new Error(`${label}安装失败:\n${res.stdout.slice(-500)}`)
  }
}

/** 启动 mock-llm，返回句柄。用 node 直跑 bin.ts（避免 shell:true 拼参数破坏 JSON 引号） */
function startMockLlm(repoPath: string): { child: ReturnType<typeof spawn>; port: number; ready: Promise<void> } {
  const port = 8000
  const child = spawn(
    process.execPath,
    [
      '--import', 'tsx',
      'packages/test-support/llm-mock-server/src/bin.ts',
      '--host', '127.0.0.1',
      '--port', String(port),
      '--api-key', 'mock-key',
      '--sequence', 'tool_call_success,success',
      '--repeat-last',
      '--tool-name', 'bash',
      '--tool-arguments', '{"command":"ls"}',
    ],
    { cwd: repoPath, shell: false, stdio: 'pipe' },
  )
  const ready = new Promise<void>((resolveReady, reject) => {
    let buf = ''
    child.stdout?.on('data', (d: Buffer) => {
      buf += d.toString()
      if (buf.includes('"type":"ready"')) resolveReady()
    })
    child.stderr?.on('data', (d: Buffer) => {
      buf += d.toString()
      if (buf.includes('"type":"ready"')) resolveReady()
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code !== null && code !== 0) reject(new Error(`mock-llm 退出码 ${code}\n${buf.slice(-800)}`))
    })
    // 30s 兜底（若仍无 ready 由调用方在 headless 失败时诊断）
    setTimeout(() => resolveReady(), 30_000)
  })
  return { child, port, ready }
}

/** Windows 下杀整棵进程树（pnpm run 会 spawn 子 node），避免孤儿占端口 */
function killTree(child: ReturnType<typeof spawn>): void {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    child.kill('SIGTERM')
  }
}

/** 跑 headless agent（auditor 已 link 进 profile，经 DSH_EVENT_AUDIT_DUMP 导出） */
function runHeadless(repoPath: string, dumpPath: string): string {
  const res = run(
    'pnpm',
    ['dsh', '--profile', 'headless', 'run the bash tool once and report'],
    {
      cwd: repoPath,
      env: {
        DEEPSEEK_BASE_URL: 'http://127.0.0.1:8000/v1',
        DEEPSEEK_API_KEY: 'mock-key',
        DSH_VERIFY_DUMP: dumpPath,
      },
      timeoutMs: 120_000,
    },
  )
  return res.stdout
}

/** 解析 dump：检查 waterfall 链完整 + agent 收尾 */
function analyze(dumpPath: string): { pass: boolean; found: string[]; missing: string[]; detail: string } {
  if (!existsSync(dumpPath)) {
    return { pass: false, found: [], missing: WATERFALL_CHAIN.map(([n]) => n), detail: 'dump 文件不存在' }
  }
  const raw = JSON.parse(readFileSync(dumpPath, 'utf8')) as { records: Array<{ event: string }> }
  const foundSet = new Set(raw.records.map((r) => r.event))
  const missing = WATERFALL_CHAIN.map(([n]) => n).filter((n) => !foundSet.has(n))
  const found = WATERFALL_CHAIN.map(([n]) => n).filter((n) => foundSet.has(n))
  const hasResult = foundSet.has('tools/result')
  const detail = `捕获事件: ${raw.records.length} | waterfall: ${found.length}/${WATERFALL_CHAIN.length} | tools/result: ${hasResult ? '是' : '否'}`
  return { pass: missing.length === 0 && hasResult, found, missing, detail }
}

export async function main(): Promise<number> {
  let args: CliArgs
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`)
    return 2
  }

  mkdirSync(args.outDir, { recursive: true })

  try {
    console.log(`[1/5] 前置检查 DSH checkout: ${args.repoPath}`)
    preflight(args.repoPath)
    console.log(`[2/5] 安装插件 + verify-auditor 到 headless profile`)
    const auditorDir = join(__dirname, '..', 'auditor')
    installPlugin(args.repoPath, auditorDir, 'verify-auditor')
    installPlugin(args.repoPath, args.pluginPath, '待验证插件')
    console.log('[3/5] 启动 mock-llm (port 8000)')
    const mock = startMockLlm(args.repoPath)
    try {
      await mock.ready  // ⚠️ 必须等 mock-llm 监听就绪再跑 headless，否则 TRANSPORT 失败
      console.log('[4/5] 跑 headless agent（verify-auditor 监听 waterfall 链）')
      const output = runHeadless(args.repoPath, args.dumpPath)
      if (args.verbose) console.log(output)
      console.log('[5/5] 分析事件审计')
      const result = analyze(args.dumpPath)

      const report = {
        plugin: args.pluginPath,
        repo: args.repoPath,
        date: new Date().toISOString(),
        pass: result.pass,
        waterfallFound: result.found,
        waterfallMissing: result.missing,
        detail: result.detail,
      }
      const reportFile = join(args.outDir, 'verify-report.json')
      writeFileSync(reportFile, JSON.stringify(report, null, 2))

      console.log(`\n${result.pass ? '✅ 通过' : '❌ 未通过'} | ${result.detail}`)
      console.log(`报告: ${reportFile}`)
      return result.pass ? 0 : 1
    } finally {
      killTree(mock.child)
    }
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`)
    return 2
  }
}

main().then((code) => process.exit(code))

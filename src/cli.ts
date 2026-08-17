/**
 * dsh-plugin-verify — CLI 入口。
 * 验证流程（封装 2026-08-14 已实证的方法论 + 官方 postmortem 规则）：
 *  0. 静态规则（scripts/static-rules.mjs）：R1 入口形态（0001 unwrapExports）、
 *     R2 patch YAML（0002 !!js 位置）——确定性信号，不阻塞运行时判定
 *  1. 定位 DSH checkout（--repo 或 DSH_REPO 环境变量）
 *  2. 把待验证插件 link 进 headless profile
 *  3. 启动 mock-llm（tool_call_success 触发工具调用）
 *  4. 用 --patch 注入 verify-auditor + DSH_VERIFY_DUMP 跑 headless agent
 *  5. 解析 dump：waterfall 链完整 + agent 收尾 + R3 tools/result 语义
 *     （UNKNOWN_TOOL 判失败，postmortem 0002 快照教训）
 *  6. 输出报告（JSON + 人类可读），退出码 0=通过 1=未通过 2=环境错误
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

/** 工具层冒烟抽样数：超多工具插件（如 30 工具）只冒烟前 N 个，防验证拖垮 */
const SMOKE_SAMPLE = 3

interface CliArgs {
  pluginPath: string
  repoPath: string
  outDir: string
  dumpPath: string
  fullName: string
  verbose: boolean
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args = [...argv]
  let pluginPath = ''
  let repoPath = process.env.DSH_REPO ?? ''
  let outDir = process.cwd()
  let fullName = ''
  let verbose = false

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--repo') {
      repoPath = args[++i] ?? ''
    } else if (a === '--out') {
      outDir = args[++i] ?? ''
    } else if (a === '--full-name') {
      fullName = args[++i] ?? ''
    } else if (a === '--verbose') {
      verbose = true
    } else if (!a.startsWith('-')) {
      pluginPath = a
    }
  }

  if (!pluginPath) {
    throw new Error('用法: dsh-plugin-verify <插件路径或git URL> [--repo <DSH checkout路径>] [--out <报告目录>] [--full-name <owner/name>]')
  }
  if (!repoPath) {
    throw new Error('未指定 DSH checkout：用 --repo 或 DSH_REPO 环境变量')
  }
  // ⚠️ dumpPath 必须绝对路径：auditor 在 headless 子进程里写文件，相对路径会随
  // 子进程 cwd（profile 目录/checkout）漂移导致 dump 写丢（2026-08-14 实测踩到）
  return { pluginPath, repoPath, outDir, dumpPath: resolve(outDir, 'verify-dump.json'), fullName, verbose }
}

/** 推导插件仓库标识 owner/name（报告 fullName 字段，市场索引的规范映射键）。
 * 优先 --full-name 显式值；其次从 git URL（github:o/r 或 https://github.com/o/r）解析；
 * 本地路径无法推断 → null（发布层按 REPO_MAP 回填）。 */
function deriveFullName(pluginPath: string, flagValue: string): string | null {
  if (flagValue) {
    return flagValue.replace(/^github:/, '').replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '')
  }
  const m = /github:([^/]+\/[^/]+)/.exec(pluginPath) ?? /https?:\/\/github\.com\/([^/]+\/[^/]+)/.exec(pluginPath)
  return m ? m[1].replace(/\.git$/, '') : null
}

/** 自身版本（verifiedBy 带版本号，市场可追溯校验器版本） */
function selfVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))
    return `dsh-plugin-verify@${pkg.version ?? '0'}`
  } catch {
    return 'dsh-plugin-verify@0'
  }
}

/** security 摘要：从静态规则结果聚合（P202/P401 warn → warnings，否则 clean）。
 * 报告自包含，数据层无需再推导。 */
function securitySummary(rules: Array<{ name: string; pass: boolean; detail: string; warn?: boolean }>): { status: string; warnings: Array<{ rule: string; detail: string }> } | null {
  const secRules = rules.filter((r) => r.name?.startsWith('P202') || r.name?.startsWith('P401'))
  if (secRules.length === 0) return null
  const warnings = secRules
    .filter((r) => r.warn)
    .map((r) => ({ rule: r.name, detail: (r.detail ?? '').slice(0, 160) }))
  return { status: warnings.length === 0 ? 'clean' : 'warnings', warnings }
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

/** 验证后自清理目标插件（读 package.json name 移除）。
 * ⚠️ 必须做：失败的插件会永久 link 进 headless profile，若它声明了 headless
 * 缺失的必选服务（如 webServer）会 pending 阻塞整个 profile 树，污染后续所有验证。 */
function removePlugin(repoPath: string, pluginPath: string): void {
  try {
    const abs = resolve(pluginPath)
    const pkg = JSON.parse(readFileSync(join(abs, 'package.json'), 'utf8')) as { name?: string }
    if (!pkg.name) return
    const res = run('pnpm', ['dsh', 'plugin', '--profile', 'headless', 'remove', pkg.name], {
      cwd: repoPath,
      timeoutMs: 120_000,
    })
    if (res.code !== 0) {
      process.stderr.write(`[warn] 自清理失败（${pkg.name}）: ${res.stdout.slice(-200)}\n`)
    }
  } catch {
    // 自清理失败不阻塞验证结论
  }
}

/** 验证后自清理 verify-auditor 自身。
 * ⚠️ 必须做：auditor 每次都会被 link 进 headless profile，若不清理会残留；
 *    下次（可能来自不同安装路径的 CLI）再 add 同名 auditor → duplicate entry id。 */
function removeAuditor(repoPath: string): void {
  try {
    const abs = join(__dirname, '..', 'auditor')
    const pkg = JSON.parse(readFileSync(join(abs, 'package.json'), 'utf8')) as { name?: string }
    if (!pkg.name) return
    const res = run('pnpm', ['dsh', 'plugin', '--profile', 'headless', 'remove', pkg.name], {
      cwd: repoPath,
      timeoutMs: 120_000,
    })
    if (res.code !== 0) {
      process.stderr.write(`[warn] auditor 自清理失败（${pkg.name}）: ${res.stdout.slice(-200)}\n`)
    }
  } catch {
    // 自清理失败不阻塞验证结论
  }
}

/** 带依赖插件 link 前先装依赖。
 * ⚠️ 实测（2026-08-17，chat-import fzstd / dsh-TUI 30 deps）：link 安装不会解析插件自身
 *    dependencies，缺依赖 → ERR_MODULE_NOT_FOUND 加载失败，误判"运行时未激活"。
 *    必须在 link 前对插件目录 pnpm install（幂等，无依赖时跳过）。 */
function ensureDeps(pluginPath: string): void {
  const pkgPath = join(pluginPath, 'package.json')
  if (!existsSync(pkgPath)) return
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { dependencies?: Record<string, string> }
  const deps = Object.keys(pkg.dependencies ?? {})
  if (deps.length === 0) return
  const modulesDir = join(pluginPath, 'node_modules')
  if (existsSync(modulesDir) && deps.every((d) => existsSync(join(modulesDir, d)))) return
  process.stderr.write(`[deps] ${deps.length} 个依赖待安装（${deps.slice(0, 5).join(', ')}${deps.length > 5 ? '…' : ''}）\n`)
  const res = run('pnpm', ['install', '--no-frozen-lockfile'], { cwd: pluginPath, timeoutMs: 300_000 })
  if (res.code !== 0) {
    throw new Error(`插件依赖安装失败:\n${res.stdout.slice(-500)}`)
  }
}

/** 是否命令/工具式插件：lib/ 下存在 tools.register 调用。
 * 这类插件经 ctx.tools.register 暴露工具给 agent，但工具是手动/按需调用，
 * 不挂在 waterfall 事件链上——7/7 事件链测不到，走工具层冒烟通道。
 * ⚠️ 必须同时匹配 .js 与 .mjs（ESM 插件如 chat-import 的 lib/*.mjs，2026-08-17 实测漏检）。 */
function isToolsPlugin(pluginPath: string): boolean {
  const libDir = join(pluginPath, 'lib')
  if (!existsSync(libDir)) return false
  return readdirSync(libDir).some((f) => {
    if (!/\.m?js$/u.test(f)) return false
    const text = readFileSync(join(libDir, f), 'utf8')
    return /ctx\.tools\.register|tools\.register\(/.test(text)
  })
}

/** 枚举插件声明的工具名（defineTool 块内 name 字段）。
 * 静态提取，用于工具层冒烟的目标清单；取前 max 个防超大插件（如 30 工具）拖垮验证。 */
function enumerateTools(pluginPath: string, max = 8): string[] {
  const libDir = join(pluginPath, 'lib')
  if (!existsSync(libDir)) return []
  const names = new Set<string>()
  for (const file of readdirSync(libDir)) {
    if (!/\.m?js$/u.test(file)) continue
    const text = readFileSync(join(libDir, file), 'utf8')
    // 兼容两种形态：defineTool({ name: 'x', ... }) 与 register(defineTool({ name: 'x', ... }))
    for (const re of [
      /defineTool\(\{[\s\S]*?name:\s*['"]([^'"]+)['"]/g,
      /register\(defineTool\(\{[\s\S]*?name:\s*['"]([^'"]+)['"]/g,
    ]) {
      for (const m of text.matchAll(re)) names.add(m[1] as string)
    }
  }
  return [...names].slice(0, max)
}

/** 工具层冒烟判定：目标工具真实注册 + 调用成功。
 * 核心是"能装且工具能用"：UNKNOWN_TOOL（postmortem 0002）= 注册面被破坏判失败；
 * 有成功 tools/result = 工具真实处理了调用。参数级断言（R4 的 execArgs）对插件
 * 工具不适用（底层可能是任意执行器），故以注册 + 成功调用为准。 */
function analyzeToolSmoke(dumpPath: string, toolName: string): RuntimeRuleResult {
  if (!existsSync(dumpPath)) {
    return { name: `TS-${toolName}`, pass: false, detail: `无 dump——工具 ${toolName} 冒烟未执行` }
  }
  const raw = JSON.parse(readFileSync(dumpPath, 'utf8')) as {
    records: Array<{ event: string; payload?: { isError?: boolean; code?: string; message?: string } }>
  }
  const results = raw.records.filter((r) => r.event === 'tools/result')
  const blocked = results.some((r) => r.payload?.isError
    && r.payload.code === 'UNKNOWN_TOOL'
    && (r.payload.message ?? '').includes(toolName))
  const anyOk = results.some((r) => !r.payload?.isError)
  if (blocked) {
    return { name: `TS-${toolName}`, pass: false, detail: `工具 ${toolName} 未注册（UNKNOWN_TOOL）——注册面被插件/组合破坏` }
  }
  if (!anyOk) {
    return { name: `TS-${toolName}`, pass: false, detail: `工具 ${toolName} 已触发但无成功结果（dump ${results.length} 条 tools/result）` }
  }
  return { name: `TS-${toolName}`, pass: true, detail: `工具 ${toolName} 真实注册 + 调用成功（${results.length} 条 tools/result，无 isError）` }
}

/** 启动 mock-llm，返回句柄。用 node 直跑 bin.ts（避免 shell:true 拼参数破坏 JSON 引号）。
 * ⚠️ 平台边界（2026-08-14 实测，读 base/cordis.patch.yml）：DSH 按平台启停 shell——
 *   Windows 上 `tool-bash disabled: !!js process.platform === 'win32'`（bash 未注册），
 *   正确工具是 `pwsh`；非 Windows 才是 bash。mock 触发工具必须平台感知，
 *   否则 UNKNOWN_TOOL/INVALID_ARGS 空转循环（旧验证从未真实触发工具执行）。
 *   ⚠️ 工具参数必须含 `description`（tool-bash/tool-pwsh 的 validateBashArgs/PwshToolArgs
 *   都要求 command + description，缺 description 抛 INVALID_ARGS）。
 *   @param opts.toolName 触发工具名（默认平台 shell pwsh/bash）；工具层冒烟传插件工具名。
 *   @param opts.toolArgs 触发工具参数 JSON（默认 echo ok；插件工具用其合法缺省参数如 {}）。
 *   @param opts.repeatLast 是否 --repeat-last。事件链验证需要多轮；工具层冒烟必须关掉
 *     （repeat-last 会让 agent 无限重发工具调用不收敛，timeout 杀进程导致 dump 写丢——
 *     2026-08-17 试点实测）。
 *   @param opts.sequence mock 行为序列（默认 tool_call_success,success）。工具层冒烟用
 *     更长的 success 尾段，减少序列耗尽后 script_exhausted 空响应导致的 agent 重试段。 */
function startMockLlm(
  repoPath: string,
  opts: { toolName?: string; toolArgs?: string; repeatLast?: boolean; sequence?: string } = {},
): { child: ReturnType<typeof spawn>; port: number; ready: Promise<void>; toolName: string } {
  const port = 8000
  const isWin = process.platform === 'win32'
  const toolName = opts.toolName ?? (isWin ? 'pwsh' : 'bash')
  const toolArgs = opts.toolArgs ?? JSON.stringify({ command: 'echo ok', description: 'verify tool execution' })
  const repeatLast = opts.repeatLast ?? true
  const sequence = opts.sequence ?? 'tool_call_success,success'
  const child = spawn(
    process.execPath,
    [
      '--import', 'tsx',
      'packages/test-support/llm-mock-server/src/bin.ts',
      '--host', '127.0.0.1',
      '--port', String(port),
      '--api-key', 'mock-key',
      '--sequence', sequence,
      ...(repeatLast ? ['--repeat-last'] : []),
      '--tool-name', toolName,
      '--tool-arguments', toolArgs,
    ],
    { cwd: repoPath, shell: false, stdio: 'pipe' },
  )
  // 透传 mock-llm 输出到 stderr 便于诊断（不混入 stdout 的进度输出）
  child.stdout?.on('data', (d: Buffer) => process.stderr.write(`[mock] ${d.toString()}`))
  child.stderr?.on('data', (d: Buffer) => process.stderr.write(`[mock] ${d.toString()}`))
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
  return { child, port, ready, toolName }
}

/** Windows 下杀整棵进程树（pnpm run 会 spawn 子 node），避免孤儿占端口 */
function killTree(child: ReturnType<typeof spawn>): void {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    child.kill('SIGTERM')
  }
}

/** 跑 headless agent（auditor 已 link 进 profile，经 DSH_VERIFY_DUMP 导出）。
 * @param prompt 会话指令：事件链验证用 "run the bash tool once and report"；
 *   工具层冒烟用 "call the tool <name> once and stop"（单轮收敛，无 repeat-last）。 */
function runHeadless(repoPath: string, dumpPath: string, prompt = 'run the bash tool once and report'): string {
  const res = run(
    'pnpm',
    ['dsh', '--profile', 'headless', prompt],
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

interface RuntimeRuleResult {
  name: string
  pass: boolean
  detail: string
}

interface AnalyzeResult {
  pass: boolean
  found: string[]
  missing: string[]
  detail: string
  rules: RuntimeRuleResult[]
}

/** 解析 dump：检查 waterfall 链完整 + agent 收尾 + 工具执行语义（R3）。
 * @param targetToolName mock 触发/期望执行的目标工具名（win=pwsh 否则 bash，
 *   与 startMockLlm 一致）——R3 用它区分"平台预期失败"与"插件破坏工具注册"：
 *   目标工具本身 UNKNOWN_TOOL = 工具链被破坏（postmortem 0002 场景）→ 判失败；
 *   其他 isError（INVALID_ARGS/sandbox denied 等）→ 记录不判失败（参数/平台/策略相关）。
 * @param expectedArg mock 触发的工具参数片段（如 'echo ok'）——R4 功能冒烟：
 *   断言参数真实到达工具层（tools/execute 载荷），证明"能装且能用"而不只是"能加载"。 */
export function analyze(dumpPath: string, targetToolName?: string, expectedArg = 'echo ok'): AnalyzeResult {
  if (!existsSync(dumpPath)) {
    return {
      pass: false,
      found: [],
      missing: WATERFALL_CHAIN.map(([n]) => n),
      detail: 'dump 文件不存在',
      rules: [
        { name: 'R3-tools-result', pass: false, detail: '无 dump 可检查' },
        { name: 'R4-function-smoke', pass: false, detail: '无 dump 可检查' },
      ],
    }
  }
  const raw = JSON.parse(readFileSync(dumpPath, 'utf8')) as {
    records: Array<{ event: string; payload?: { isError?: boolean; code?: string; message?: string; execName?: string; execArgs?: string } }>
  }
  const foundSet = new Set(raw.records.map((r) => r.event))
  const missing = WATERFALL_CHAIN.map(([n]) => n).filter((n) => !foundSet.has(n))
  const found = WATERFALL_CHAIN.map(([n]) => n).filter((n) => foundSet.has(n))
  const hasResult = foundSet.has('tools/result')
  const detail = `捕获事件: ${raw.records.length} | waterfall: ${found.length}/${WATERFALL_CHAIN.length} | tools/result: ${hasResult ? '是' : '否'}`

  // R3：tools/result 载荷语义。postmortem 0002 教训：工具缺失以 UNKNOWN_TOOL 出现，
  // 必须语义断言。但平台边界（base/cordis.patch.yml 按平台启停 shell）会让
  // "非目标平台工具" UNKNOWN_TOOL 成为预期——只有**目标工具本身**未注册才是插件/组合破坏。
  const toolResults = raw.records.filter((r) => r.event === 'tools/result')
  const targetBlocked = targetToolName !== undefined
    && toolResults.some((r) => r.payload?.isError
      && r.payload.code === 'UNKNOWN_TOOL'
      && (r.payload.message ?? '').includes(targetToolName))
  const firstErr = toolResults.find((r) => r.payload?.isError)
  const r3Detail = targetBlocked
    ? `目标工具 ${targetToolName} 未注册（UNKNOWN_TOOL）——工具链被插件/组合破坏（postmortem 0002 教训）`
    : firstErr
      ? `工具已触发（目标 ${targetToolName ?? '未知'}）：${firstErr.payload?.code}（${firstErr.payload?.message}）——平台/参数/策略相关，不判失败`
      : `工具真实执行成功（${toolResults.length} 次结果，无 isError）`

  // R4：功能冒烟——mock 触发的工具参数是否真实到达工具层（tools/execute 载荷）。
  // 这是"能装且能用"的证据：waterfall 链完整只证明插件没破坏宿主，R4 证明
  // 工具调用的参数真实生效（echo ok 到达 pwsh/bash 的执行层）。
  const execs = raw.records.filter((r) => r.event === 'tools/execute')
  const matchedExec = execs.find((r) => r.payload?.execName !== undefined)
  const argsReached = matchedExec?.payload?.execArgs !== undefined
    && matchedExec.payload.execArgs.includes(expectedArg)
  const r4Detail = !matchedExec
    ? `无 tools/execute 载荷（工具未触发或审计器旧版）——功能冒烟未覆盖`
    : argsReached
      ? `功能冒烟通过：工具 ${matchedExec.payload?.execName} 收到参数（含 "${expectedArg}"），参数真实到达执行层`
      : `功能冒烟未过：工具 ${matchedExec.payload?.execName} 已触发但参数未含 "${expectedArg}"（实际: ${matchedExec.payload?.execArgs ?? '无'}）`

  const rules: RuntimeRuleResult[] = [
    { name: 'R3-tools-result', pass: !targetBlocked, detail: r3Detail },
    // R4 是附加证据（不并入总 pass）：兼容旧报告与工具未触发的合法场景
    { name: 'R4-function-smoke', pass: argsReached, detail: r4Detail },
  ]
  return { pass: missing.length === 0 && hasResult && !targetBlocked, found, missing, detail, rules }
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
    // 静态规则（postmortem 0001/0002 驱动）：确定性信号，不阻塞运行时判定
    const staticModule = await import(
      pathToFileURL(join(__dirname, '..', 'scripts', 'static-rules.mjs')).href
    ) as { runStaticRules: (dir: string) => { rules: Array<{ name: string; pass: boolean; detail: string }> } }
    const staticResult = staticModule.runStaticRules(args.pluginPath)
    for (const r of staticResult.rules) {
      console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}: ${r.detail}`)
    }

    console.log(`[1/5] 前置检查 DSH checkout: ${args.repoPath}`)
    preflight(args.repoPath)
    console.log(`[2/5] 安装插件 + verify-auditor 到 headless profile`)
    const auditorDir = join(__dirname, '..', 'auditor')
    ensureDeps(args.pluginPath)                      // ⚠️ 带依赖插件 link 前先装依赖（2026-08-17 实测缺省加载失败）
    installPlugin(args.repoPath, auditorDir, 'verify-auditor')
    installPlugin(args.repoPath, args.pluginPath, '待验证插件')

    const toolsKind = isToolsPlugin(args.pluginPath)
    if (toolsKind) {
      // ── 工具层冒烟通道：命令/工具式插件（2026-08-17 试点验证成立）──
      // 不挂 waterfall 事件链的插件 7/7 测不到（0/7 误判），改验"工具真实注册 + 可调用"。
      const tools = enumerateTools(args.pluginPath)
      console.log(`[3/5] 命令/工具式插件：枚举 ${tools.length} 个声明工具，抽样冒烟前 ${Math.min(SMOKE_SAMPLE, tools.length)} 个`)
      const smokeRules: RuntimeRuleResult[] = []
      const triggered: string[] = []
      for (const tool of tools.slice(0, SMOKE_SAMPLE)) {
        console.log(`      → mock 触发 ${tool}`)
        // 单轮收敛：repeatLast=false（repeat-last 无限重发不收敛，dump 写丢，2026-08-17 实测）
        const mock = startMockLlm(args.repoPath, {
          toolName: tool,
          toolArgs: '{}',
          repeatLast: false,
          sequence: 'tool_call_success,success,success,success,success',
        })
        try {
          await mock.ready
          const output = runHeadless(args.repoPath, args.dumpPath, `call the tool ${tool} once and stop`)
          if (args.verbose) console.log(output)
          const r = analyzeToolSmoke(args.dumpPath, tool)
          if (r.pass) triggered.push(tool)
          smokeRules.push(r)
          console.log(`      ${r.pass ? '✓' : '✗'} ${r.name}: ${r.detail}`)
        } finally {
          killTree(mock.child)
        }
      }
      const allRules = [...staticResult.rules, ...smokeRules]
      const pass = smokeRules.length > 0 && smokeRules.every((r) => r.pass)
      const detail = `工具层冒烟: ${triggered.length}/${smokeRules.length} 通过（共声明 ${tools.length}，抽样）| 交互命令层未测`
      const report = {
        plugin: args.pluginPath,
        repo: args.repoPath,
        fullName: deriveFullName(args.pluginPath, args.fullName),
        date: new Date().toISOString(),
        pass,
        kind: 'tools' as const,
        verifiedBy: selfVersion(),
        schemaVersion: 1,
        waterfallFound: [] as string[],
        waterfallMissing: [] as string[],
        toolSmoke: { declared: tools.length, sampled: smokeRules.length, triggered, detail },
        rules: allRules,
        security: securitySummary(allRules),
        detail,
      }
      const reportFile = join(args.outDir, 'verify-report.json')
      writeFileSync(reportFile, JSON.stringify(report, null, 2))
      console.log(`\n${pass ? '✅ 通过（工具层）' : '❌ 未通过'} | ${detail}`)
      console.log(`报告: ${reportFile}`)
      removePlugin(args.repoPath, args.pluginPath)
      removeAuditor(args.repoPath)
      return pass ? 0 : 1
    }

    console.log('[3/5] 启动 mock-llm (port 8000)')
    const mock = startMockLlm(args.repoPath)
    try {
      await mock.ready  // ⚠️ 必须等 mock-llm 监听就绪再跑 headless，否则 TRANSPORT 失败
      console.log('[4/5] 跑 headless agent（verify-auditor 监听 waterfall 链）')
      const output = runHeadless(args.repoPath, args.dumpPath)
      if (args.verbose) console.log(output)
      console.log('[5/5] 分析事件审计')
      const result = analyze(args.dumpPath, mock.toolName)
      const allRules = [...staticResult.rules, ...result.rules]

      const report = {
        plugin: args.pluginPath,
        repo: args.repoPath,
        fullName: deriveFullName(args.pluginPath, args.fullName),
        date: new Date().toISOString(),
        pass: result.pass,
        kind: 'chain' as const,
        verifiedBy: selfVersion(),
        schemaVersion: 1,
        waterfallFound: result.found,
        waterfallMissing: result.missing,
        rules: allRules,
        security: securitySummary(allRules),
        detail: result.detail,
      }
      const reportFile = join(args.outDir, 'verify-report.json')
      writeFileSync(reportFile, JSON.stringify(report, null, 2))

      console.log(`\n${result.pass ? '✅ 通过' : '❌ 未通过'} | ${result.detail}`)
      console.log(`报告: ${reportFile}`)
      return result.pass ? 0 : 1
    } finally {
      killTree(mock.child)
      removePlugin(args.repoPath, args.pluginPath)  // 自清理目标插件，防残留阻塞
      removeAuditor(args.repoPath)                  // 自清理 auditor 自身，防重复 id
    }
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`)
    return 2
  }
}

main().then((code) => process.exit(code))

/**
 * verify-auditor — dsh-plugin-verify 自包含迷你审计器（cordis 插件）。
 * 通过 --patch 注入 headless profile：监听 waterfall 链关键事件，进程退出时
 * 把审计快照 dump 到 DSH_EVENT_AUDIT_DUMP 指向的文件。
 *
 * 不依赖 dsh-event-auditor——CLI 自包含，任何插件作者装了这个 CLI 就能验证自己的插件。
 *
 * 事件签名依据 master 源码（2026-08-14 已逐条确认，next 均无参）：
 *  system-prompt/assemble(assembly, context, next)
 *  agent/pre-step(payload, next)
 *  agent/request(payload, next)
 *  llm/stream(options, next)
 *  tools/pre-execute(exec, next)
 *  tools/execute(exec, next)
 *  tools/post-execute(exec, result, next)
 */

import { createRequire } from 'node:module'
import type { Context } from '@deepseek-ai/cordis'

const req = createRequire(import.meta.url)

export const name = 'verify-auditor'

/** 验证所需的 waterfall 链（顺序即期望出现顺序） */
export const WATERFALL_CHAIN: ReadonlyArray<readonly [string, string]> = [
  ['system-prompt/assemble', 'waterfall'],
  ['agent/pre-step', 'waterfall'],
  ['agent/request', 'waterfall'],
  ['llm/stream', 'waterfall'],
  ['tools/pre-execute', 'waterfall'],
  ['tools/execute', 'waterfall'],
  ['tools/post-execute', 'waterfall'],
]

interface AuditRecord {
  event: string
  mode: string
  at: number
  seq: number
  /** tools/result 载荷摘要（仅 isError/code/message，防大对象撑爆 dump）；
   *  tools/execute 载荷摘要（execName + execArgs 截断，功能冒烟断言用） */
  payload?: { isError?: boolean; code?: string; message?: string; execName?: string; execArgs?: string }
}

function watch(ctx: Context, event: string, handler: (...args: unknown[]) => void): () => void {
  const on = ctx.on as unknown as (name: string, listener: (...args: unknown[]) => void) => () => void
  return on(event, handler)
}

/** waterfall 观察者：必须透传 next()，否则静默吞掉下游行为 */
function watchWaterfall(
  ctx: Context,
  event: string,
  handler: (...args: unknown[]) => void,
): () => void {
  const on = ctx.on as unknown as (
    name: string,
    listener: (...args: unknown[]) => unknown,
  ) => () => void
  return on(event, (...args: unknown[]) => {
    handler(...args)
    const next = args[args.length - 1]
    if (typeof next === 'function') {
      return (next as () => unknown)()
    }
    return undefined
  })
}

export function apply(ctx: Context): void {
  const records: AuditRecord[] = []
  let seq = 0

  // headless dump：事件驱动即时写盘 + 进程退出兜底。
  // ⚠️ 2026-08-17 实测：headless 会话可能不自然退出（mock 序列耗尽后 agent 重试循环，
  //   timeout 杀进程），仅靠 process.on('exit') 写 dump 会丢全部记录（dump 不落盘）。
  //   改为每次记录后即时写（记录量小，开销可忽略），保证工具层冒烟/事件链判定
  //   在进程被杀时也能拿到快照。用独立变量 DSH_VERIFY_DUMP：避免与 dsh-event-auditor
  //   的 DSH_EVENT_AUDIT_DUMP 冲突。
  const dumpPath = process.env.DSH_VERIFY_DUMP
  const writeDump = (): void => {
    if (dumpPath === undefined || dumpPath.length === 0) return
    const { writeFileSync } = req('node:fs') as { writeFileSync: (p: string, d: string) => void }
    try {
      writeFileSync(dumpPath, JSON.stringify({ records }, null, 2))
    } catch {
      // 写盘失败不阻塞事件链（dump 是诊断证据，非宿主行为）
    }
  }

  for (const [eventName, mode] of WATERFALL_CHAIN) {
    const dispose = watchWaterfall(ctx, eventName, (...args: unknown[]) => {
      const rec: AuditRecord = { event: eventName, mode, at: Date.now(), seq: seq++ }
      // 功能冒烟：tools/execute 捕获 exec 的参数摘要（arguments 截断防大对象）
      if (eventName === 'tools/execute') {
        const exec = (args[0] ?? {}) as { name?: string; arguments?: unknown }
        if (typeof exec.name === 'string') {
          rec.payload = { execName: exec.name }
        }
        if (exec.arguments !== undefined) {
          try {
            const s = JSON.stringify(exec.arguments)
            rec.payload = {
              ...(rec.payload ?? {}),
              execArgs: s.length > 300 ? s.slice(0, 300) : s,
            }
          } catch {
            // 不可序列化的 arguments（罕见）跳过，不影响 waterfall 判定
          }
        }
      }
      records.push(rec)
      writeDump()
    })
    ctx.effect(() => dispose, `verify-auditor: watch ${eventName}`)
  }

  // agent 收尾信号（非 waterfall，仅确认循环真正走完）
  // 载荷摘要：tools/result(exec, result)，result.isError + error.info.code/message
  // （ToolNotFoundError 的 code === 'UNKNOWN_TOOL'——postmortem 0002 快照教训：
  //  工具缺失会以 UNKNOWN_TOOL 形式出现，必须在运行时判失败，不能只比对输出）
  const disposeResult = watch(ctx, 'tools/result', (_exec, result) => {
    const r = (result ?? {}) as {
      isError?: boolean
      error?: { info?: { code?: string }; message?: string }
    }
    const rec: AuditRecord = { event: 'tools/result', mode: 'emit', at: Date.now(), seq: seq++ }
    if (typeof r.isError === 'boolean') {
      rec.payload = {
        isError: r.isError,
        code: r.isError ? (r.error?.info?.code ?? undefined) : undefined,
        message: r.isError ? r.error?.message : undefined,
      }
    }
    records.push(rec)
    writeDump()
  })
  ctx.effect(() => disposeResult, 'verify-auditor: watch tools/result')

  if (dumpPath !== undefined && dumpPath.length > 0) {
    process.on('exit', writeDump)
  }
}

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

  for (const [eventName, mode] of WATERFALL_CHAIN) {
    const dispose = watchWaterfall(ctx, eventName, () => {
      records.push({ event: eventName, mode, at: Date.now(), seq: seq++ })
    })
    ctx.effect(() => dispose, `verify-auditor: watch ${eventName}`)
  }

  // agent 收尾信号（非 waterfall，仅确认循环真正走完）
  const disposeResult = watch(ctx, 'tools/result', () => {
    records.push({ event: 'tools/result', mode: 'emit', at: Date.now(), seq: seq++ })
  })
  ctx.effect(() => disposeResult, 'verify-auditor: watch tools/result')

  // headless dump：进程退出前写快照（exit 回调是同步的，用 createRequire 同步读）
  // ⚠️ 用独立变量 DSH_VERIFY_DUMP：避免与 dsh-event-auditor 的 DSH_EVENT_AUDIT_DUMP 冲突
  const dumpPath = process.env.DSH_VERIFY_DUMP
  if (dumpPath !== undefined && dumpPath.length > 0) {
    process.on('exit', () => {
      const { writeFileSync } = req('node:fs') as { writeFileSync: (p: string, d: string) => void }
      writeFileSync(dumpPath, JSON.stringify({ records }, null, 2))
    })
  }
}

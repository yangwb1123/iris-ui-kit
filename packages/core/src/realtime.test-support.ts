import { vi } from 'vitest'
import type { RealtimeSink } from './realtime'

/** A controllable fake transport + a manual scheduler for deterministic tests. */
export function harness() {
  const sinks: RealtimeSink<number>[] = []
  const disconnect = vi.fn()
  const connect = vi.fn((sink: RealtimeSink<number>) => {
    sinks.push(sink)
    return disconnect
  })
  const pending: Array<{ fn: () => void; ms: number }> = []
  const schedule = (fn: () => void, ms: number) => {
    const item = { fn, ms }
    pending.push(item)
    return () => {
      const i = pending.indexOf(item)
      if (i !== -1) pending.splice(i, 1)
    }
  }
  const runNext = () => {
    const item = pending.shift()
    item?.fn()
    return item?.ms
  }
  return {
    sinks,
    connect,
    disconnect,
    schedule,
    pending,
    runNext,
    last: () => sinks[sinks.length - 1]!,
  }
}

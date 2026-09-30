import { vi, type Mock } from 'vitest'
import type { RealtimeSink } from './realtime'

type Disconnect = () => void
type Connect = (sink: RealtimeSink<number>) => Disconnect

type RealtimeHarness = {
  sinks: RealtimeSink<number>[]
  connect: Mock<Connect>
  disconnect: Mock<Disconnect>
  schedule: (fn: () => void, ms: number) => Disconnect
  pending: Array<{ fn: () => void; ms: number }>
  runNext: () => number | undefined
  last: () => RealtimeSink<number>
}

/** A controllable fake transport + a manual scheduler for deterministic tests. */
export function harness(): RealtimeHarness {
  const sinks: RealtimeSink<number>[] = []
  const disconnect = vi.fn<Disconnect>()
  const connect = vi.fn<Connect>((sink) => {
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

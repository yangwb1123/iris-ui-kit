import { describe, expect, it, vi } from 'vitest'
import { createDataSource } from './data-source'
import * as codecs from './data-source/descriptor-codec'
import type { DataSourceOutboxOptions } from './data-source/types'

const fetcher = () => ({ rows: [{ id: 1 }], total: 1 })

describe('data-source descriptor codec construction', () => {
  it.each(['absent', 'disabled', 'memory-true', 'memory-options'] as const)(
    'does not request a descriptor codec for %s sources',
    (mode) => {
      const outbox =
        mode === 'absent'
          ? undefined
          : mode === 'disabled'
            ? false
            : mode === 'memory-true'
              ? true
              : { maxAttempts: 1 }
      const spy = vi.spyOn(codecs, 'createDataSourceDescriptorCodec')
      try {
        for (let i = 0; i < 200; i++) {
          const source = createDataSource({ fetcher, outbox })
          expect(source.getState().rows).toEqual([{ id: 1 }])
          source.destroy()
        }
        // Factory requests only, not a V8 heap-allocation or throughput proof.
        expect(spy).not.toHaveBeenCalled()
      } finally {
        spy.mockRestore()
      }
    },
  )

  it('creates one durable codec between storage selection and outbox load', async () => {
    const events: string[] = []
    const execute = vi.fn(async () => {})
    const storage = {
      load() {
        events.push('load')
        return [
          { id: 'restored', payload: { type: 'rename' }, attempts: 0, status: 'pending' as const },
        ]
      },
      save() {},
    }
    const options: DataSourceOutboxOptions = {
      get storage() {
        events.push('storage')
        return storage
      },
      get maxAttempts() {
        events.push('attempts')
        return 1
      },
      get executor() {
        events.push('executor')
        return execute
      },
    }
    const original = codecs.createDataSourceDescriptorCodec
    const spy = vi.spyOn(codecs, 'createDataSourceDescriptorCodec').mockImplementation((value) => {
      events.push('codec')
      return original(value)
    })
    try {
      const source = createDataSource({ fetcher, immediate: false, outbox: options })
      expect(spy).toHaveBeenCalledTimes(1)
      expect(events).toEqual(['storage', 'storage', 'codec', 'attempts', 'load', 'executor'])
      await source.outbox!.flushDetailed()
      expect(execute).toHaveBeenCalledWith({ type: 'rename' })
      source.destroy()
    } finally {
      spy.mockRestore()
    }
  })

  it('uses the original second storage read when the getter changes its result', () => {
    let reads = 0
    const first = { load: vi.fn(() => []), save: vi.fn() }
    const second = { load: vi.fn(() => []), save: vi.fn() }
    const source = createDataSource({
      fetcher,
      immediate: false,
      outbox: {
        get storage() {
          return ++reads === 1 ? first : second
        },
      },
    })
    expect(reads).toBe(2)
    expect(first.load).not.toHaveBeenCalled()
    expect(second.load).toHaveBeenCalledTimes(1)
    source.destroy()
  })

  it('still reads mutable executor options when each descriptor is decoded', async () => {
    const first = vi.fn(async () => {})
    const second = vi.fn(async () => {})
    const options: DataSourceOutboxOptions = { executor: first }
    const codec = codecs.createDataSourceDescriptorCodec(options)
    const before = codec.decode!({ type: 'rename' })
    options.executor = second
    const after = codec.decode!({ type: 'rename' })
    await before.run()
    await after.run()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })
})

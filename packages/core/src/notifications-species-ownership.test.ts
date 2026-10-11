import { describe, expect, it } from 'vitest'
import { createNotificationCenter } from './notifications'

describe('notification produced-list species ownership', () => {
  it('detaches foreign accessor records retained in an owned input filter species result', () => {
    const center = createNotificationCenter()
    center.post({ title: 'survivor' })
    const removed = center.post({ title: 'removed' })
    const descriptor = Object.getOwnPropertyDescriptor(Array, Symbol.species)!
    let title = 'original'
    const foreign = Object.freeze({
      id: 'foreign',
      get title() {
        return title
      },
      tone: 'info' as const,
      timeout: 0,
    })
    let speciesCalls = 0
    function Species() {
      speciesCalls++
      Object.defineProperty(Array, Symbol.species, descriptor)
      return [undefined, foreign]
    }
    try {
      Object.defineProperty(Array, Symbol.species, { configurable: true, value: Species })
      center.dismiss(removed)
    } finally {
      Object.defineProperty(Array, Symbol.species, descriptor)
    }
    const retained = center.getState()
    title = 'outside'
    expect(speciesCalls).toBe(1)
    expect(retained.notifications.map((notification) => notification.title)).toEqual([
      'survivor',
      'original',
    ])
    expect(Object.getOwnPropertyDescriptor(retained.notifications[1], 'title')?.get).toBeUndefined()
    center.post({ title: 'new' })
    expect(center.list().map((notification) => notification.title)).toEqual([
      'new',
      'survivor',
      'original',
    ])
  })

  it('prepends through the original spread semantics, never a foreign concat species', () => {
    const center = createNotificationCenter()
    center.post({ title: 'first' })
    const descriptor = Object.getOwnPropertyDescriptor(Array, Symbol.species)!
    let speciesCalls = 0
    function Species() {
      speciesCalls++
      Object.defineProperty(Array, Symbol.species, descriptor)
      return []
    }
    try {
      Object.defineProperty(Array, Symbol.species, { configurable: true, value: Species })
      center.post({ title: 'new' })
    } finally {
      Object.defineProperty(Array, Symbol.species, descriptor)
    }
    expect(speciesCalls).toBe(0)
    expect(center.list().map((notification) => notification.title)).toEqual(['new', 'first'])
  })
})

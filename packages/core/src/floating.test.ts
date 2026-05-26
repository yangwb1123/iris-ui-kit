import { describe, expect, it } from 'vitest'
import { createFloatingMachine } from './floating'

describe('createFloatingMachine', () => {
  it('starts in the closed state by default', () => {
    const m = createFloatingMachine()
    expect(m.store.getState().value).toBe('closed')
  })

  it('accepts an explicit initial state', () => {
    const m = createFloatingMachine('open')
    expect(m.store.getState().value).toBe('open')
  })

  it('OPEN transitions closed → open', () => {
    const m = createFloatingMachine()
    m.send({ type: 'OPEN' })
    expect(m.store.getState().value).toBe('open')
  })

  it('CLOSE transitions open → closed', () => {
    const m = createFloatingMachine('open')
    m.send({ type: 'CLOSE' })
    expect(m.store.getState().value).toBe('closed')
  })

  it('TOGGLE flips state in both directions', () => {
    const m = createFloatingMachine('closed')
    m.send({ type: 'TOGGLE' })
    expect(m.store.getState().value).toBe('open')
    m.send({ type: 'TOGGLE' })
    expect(m.store.getState().value).toBe('closed')
  })

  it('ignores OPEN while already open (no spurious notifications)', () => {
    const m = createFloatingMachine('open')
    let count = 0
    m.store.subscribe(() => count++)
    m.send({ type: 'OPEN' })
    expect(count).toBe(0)
  })

  it('ignores CLOSE while already closed', () => {
    const m = createFloatingMachine('closed')
    let count = 0
    m.store.subscribe(() => count++)
    m.send({ type: 'CLOSE' })
    expect(count).toBe(0)
  })
})

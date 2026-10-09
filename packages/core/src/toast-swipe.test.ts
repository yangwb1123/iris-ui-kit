import { describe, expect, it } from 'vitest'
import { canStartToastSwipe, createToastSwipe } from './toast-swipe'

describe('toast gesture ownership', () => {
  it.each([0, 1, 2])('does not capture an interactive descendant with button %s', (button) => {
    expect(canStartToastSwipe(true, button)).toBe(false)
  })
  it('preserves primary-pointer swiping of non-interactive content', () => {
    expect(canStartToastSwipe(false, 0)).toBe(true)
    expect(canStartToastSwipe(false)).toBe(true)
    expect(canStartToastSwipe(false, 1)).toBe(false)
    expect(canStartToastSwipe(false, 2)).toBe(false)
  })

  const pointer = (pointerId = 1, clientX = 0, isPrimary = true) => ({
    pointerId,
    clientX,
    isPrimary,
    button: 0,
  })

  it.each([-81, 81])('dismisses an owned %spx swipe', (dx) => {
    const swipe = createToastSwipe<string>()
    expect(swipe.start('toast', pointer(), false)).toBe(true)
    expect(swipe.move('toast', pointer(1, dx))).toBe(dx)
    expect(swipe.end('toast', 1)).toBe(true)
    expect(swipe.end('toast', 1)).toBeNull()
  })

  it.each([-80, 0, 80])('retains the unchanged strict threshold at %spx', (dx) => {
    const swipe = createToastSwipe<string>()
    swipe.start('toast', pointer(), false)
    swipe.move('toast', pointer(1, dx))
    expect(swipe.end('toast', 1)).toBe(false)
  })

  it('rejects interactive, secondary and non-primary starts without acquiring ownership', () => {
    const swipe = createToastSwipe<string>()
    expect(swipe.start('toast', pointer(), true)).toBe(false)
    expect(swipe.start('toast', { ...pointer(), button: 2 }, false)).toBe(false)
    expect(swipe.start('toast', pointer(2, 0, false), false)).toBe(false)
    expect(swipe.start('toast', pointer(), false)).toBe(true)
  })

  it('unrelated items and pointers cannot replace, move, finish or cancel a gesture', () => {
    const swipe = createToastSwipe<string>()
    swipe.start('first', pointer(), false)
    expect(swipe.start('second', pointer(2), false)).toBe(false)
    expect(swipe.move('first', pointer(2, 140))).toBeNull()
    expect(swipe.move('second', pointer(1, 140))).toBeNull()
    expect(swipe.end('first', 2)).toBeNull()
    expect(swipe.cancel('second', 1)).toBe(false)
    expect(swipe.cancel('first', 2)).toBe(false)
    expect(swipe.move('first', pointer(1, 140))).toBe(140)
    expect(swipe.end('first', 1)).toBe(true)
  })

  it('cancellation and reset never dismiss and allow a fresh gesture', () => {
    const swipe = createToastSwipe<string>()
    swipe.start('toast', pointer(), false)
    swipe.move('toast', pointer(1, 140))
    expect(swipe.cancel('toast', 1)).toBe(true)
    expect(swipe.end('toast', 1)).toBeNull()
    expect(swipe.start('toast', pointer(), false)).toBe(true)
    swipe.reset()
    expect(swipe.move('toast', pointer(1, 140))).toBeNull()
    expect(swipe.end('toast', 1)).toBeNull()
  })

  it('item identity prevents a replacement with the same id from inheriting a gesture', () => {
    const original = { id: 'same' }
    const replacement = { id: 'same' }
    const swipe = createToastSwipe<typeof original>()
    swipe.start(original, pointer(), false)
    swipe.move(original, pointer(1, 140))
    expect(swipe.retain([original, { id: 'other' }])).toBe(false)
    expect(swipe.end(replacement, 1)).toBeNull()
    expect(swipe.retain([replacement])).toBe(true)
    expect(swipe.end(original, 1)).toBeNull()
    expect(swipe.retain([])).toBe(false)
    expect(swipe.start(replacement, pointer(), false)).toBe(true)
  })

  it.each([NaN, Infinity, -Infinity])(
    'invalid pointer coordinates %s do not start or change a gesture',
    (value) => {
      const swipe = createToastSwipe<string>()
      expect(swipe.start('toast', pointer(value), false)).toBe(false)
      expect(swipe.start('toast', pointer(1, value), false)).toBe(false)
      expect(swipe.start('toast', pointer(), false)).toBe(true)
      expect(swipe.move('toast', pointer(1, value))).toBeNull()
      expect(swipe.end('toast', 1)).toBe(false)
    },
  )
})

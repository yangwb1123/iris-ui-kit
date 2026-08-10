import { describe, it, expect } from 'vitest'
import { createKeyboardNav } from './keyboard-nav'

/** Helper: a mock KeyboardEvent (just key + preventDefault). */
function key(key: string): { key: string; preventDefault: () => void } {
  return { key, preventDefault: () => {} }
}

describe('createKeyboardNav', () => {
  describe('initial state', () => {
    it('starts at the first enabled index by default', () => {
      const nav = createKeyboardNav({ count: 5 })
      expect(nav.index).toBe(0)
    })

    it('starts at -1 when count is 0', () => {
      const nav = createKeyboardNav({ count: 0 })
      expect(nav.index).toBe(-1)
    })

    it('accepts an explicit initialIndex', () => {
      const nav = createKeyboardNav({ count: 10, initialIndex: 3 })
      expect(nav.index).toBe(3)
    })

    it('skips disabled items for the initial index when no explicit initialIndex', () => {
      const nav = createKeyboardNav({
        count: 5,
        isEnabled: (i) => i !== 0,
      })
      expect(nav.index).toBe(1) // first enabled
    })

    it('validates explicit initialIndex against isEnabled', () => {
      const nav = createKeyboardNav({
        count: 5,
        initialIndex: 0,
        isEnabled: (i) => i !== 0,
      })
      expect(nav.index).toBe(1) // first enabled, because 0 is disabled
    })

    it('returns -1 when all items are disabled', () => {
      const nav = createKeyboardNav({
        count: 5,
        isEnabled: () => false,
      })
      expect(nav.index).toBe(-1)
    })
  })

  describe('move / ArrowDown / ArrowUp', () => {
    it('moves forward with ArrowDown', () => {
      const nav = createKeyboardNav({ count: 5 })
      const action = nav.handleKeyDown(key('ArrowDown'))
      expect(action).toEqual({ type: 'focus', target: 1 })
      expect(nav.index).toBe(1)
    })

    it('moves backward with ArrowUp', () => {
      const nav = createKeyboardNav({ count: 5, initialIndex: 3 })
      const action = nav.handleKeyDown(key('ArrowUp'))
      expect(action).toEqual({ type: 'focus', target: 2 })
      expect(nav.index).toBe(2)
    })

    it('wraps from last to first when loop is true (default)', () => {
      const nav = createKeyboardNav({ count: 5, initialIndex: 4 })
      const action = nav.handleKeyDown(key('ArrowDown'))
      expect(action).toEqual({ type: 'focus', target: 0 })
      expect(nav.index).toBe(0)
    })

    it('wraps from first to last when loop is true', () => {
      const nav = createKeyboardNav({ count: 5, initialIndex: 0 })
      const action = nav.handleKeyDown(key('ArrowUp'))
      expect(action).toEqual({ type: 'focus', target: 4 })
      expect(nav.index).toBe(4)
    })

    it('does not wrap when loop is false', () => {
      const nav = createKeyboardNav({ count: 5, initialIndex: 4, loop: false })
      const action = nav.handleKeyDown(key('ArrowDown'))
      expect(action).toEqual({ type: 'noop' })
      expect(nav.index).toBe(4) // unchanged
    })

    it('returns noop when only one item', () => {
      const nav = createKeyboardNav({ count: 1 })
      expect(nav.handleKeyDown(key('ArrowDown'))).toEqual({ type: 'noop' })
    })

    it('returns noop when no active item (all disabled)', () => {
      const nav = createKeyboardNav({ count: 5, isEnabled: () => false })
      expect(nav.index).toBe(-1)
      expect(nav.handleKeyDown(key('ArrowDown'))).toEqual({ type: 'noop' })
    })

    it('skips disabled items', () => {
      const nav = createKeyboardNav({
        count: 5,
        isEnabled: (i) => i !== 2,
      })
      // 0 → skip 1 → skip 2 (disabled) → 3
      expect(nav.handleKeyDown(key('ArrowDown'))).toEqual({ type: 'focus', target: 1 })
      expect(nav.handleKeyDown(key('ArrowDown'))).toEqual({ type: 'focus', target: 3 })
      expect(nav.index).toBe(3)
    })

    it('returns noop when next move would land on same disabled end', () => {
      const nav = createKeyboardNav({ count: 3, isEnabled: (i) => i === 0, loop: false })
      expect(nav.index).toBe(0)
      expect(nav.handleKeyDown(key('ArrowDown'))).toEqual({ type: 'noop' })
    })
  })

  describe('Home / End', () => {
    it('Home jumps to first item', () => {
      const nav = createKeyboardNav({ count: 5, initialIndex: 3 })
      const action = nav.handleKeyDown(key('Home'))
      expect(action).toEqual({ type: 'focus', target: 0 })
      expect(nav.index).toBe(0)
    })

    it('End jumps to last item', () => {
      const nav = createKeyboardNav({ count: 5 })
      expect(nav.handleKeyDown(key('End'))).toEqual({ type: 'focus', target: 4 })
      expect(nav.index).toBe(4)
    })

    it('returns noop when already at boundary', () => {
      const nav = createKeyboardNav({ count: 5 })
      // Start at 0, Home from 0 = noop
      expect(nav.handleKeyDown(key('Home'))).toEqual({ type: 'noop' })
      expect(nav.index).toBe(0)
      // End from 0 = 4
      expect(nav.handleKeyDown(key('End'))).toEqual({ type: 'focus', target: 4 })
      // End from 4 = noop
      expect(nav.handleKeyDown(key('End'))).toEqual({ type: 'noop' })
    })

    it('Home jumps to first enabled (skipping disabled)', () => {
      const nav = createKeyboardNav({
        count: 5,
        isEnabled: (i) => i !== 0 && i !== 1,
        initialIndex: 4,
      })
      const action = nav.handleKeyDown(key('Home'))
      expect(action).toEqual({ type: 'focus', target: 2 })
    })

    it('returns noop on Home/End when count is 0', () => {
      const nav = createKeyboardNav({ count: 0 })
      expect(nav.handleKeyDown(key('Home'))).toEqual({ type: 'noop' })
      expect(nav.handleKeyDown(key('End'))).toEqual({ type: 'noop' })
    })
  })

  describe('Enter / Space', () => {
    it('Enter returns select action', () => {
      const nav = createKeyboardNav({ count: 5 })
      const action = nav.handleKeyDown(key('Enter'))
      expect(action).toEqual({ type: 'select', target: 0 })
    })

    it('Space returns select action', () => {
      const nav = createKeyboardNav({ count: 5 })
      const action = nav.handleKeyDown(key(' '))
      expect(action).toEqual({ type: 'select', target: 0 })
    })

    it('returns noop on Enter when no item is active', () => {
      const nav = createKeyboardNav({ count: 0 })
      const action = nav.handleKeyDown(key('Enter'))
      expect(action).toEqual({ type: 'noop' })
    })
  })

  describe('Escape', () => {
    it('returns escape action', () => {
      const nav = createKeyboardNav({ count: 5 })
      const action = nav.handleKeyDown(key('Escape'))
      expect(action).toEqual({ type: 'escape' })
    })
  })

  describe('orientation: horizontal', () => {
    it('ArrowLeft/Right move focus in horizontal mode', () => {
      const nav = createKeyboardNav({ count: 5, orientation: 'horizontal' })
      expect(nav.handleKeyDown(key('ArrowRight'))).toEqual({ type: 'focus', target: 1 })
      expect(nav.handleKeyDown(key('ArrowLeft'))).toEqual({ type: 'focus', target: 0 })
    })

    it('ArrowUp/Down return previous/next actions in horizontal mode', () => {
      const nav = createKeyboardNav({ count: 5, orientation: 'horizontal' })
      expect(nav.handleKeyDown(key('ArrowDown'))).toEqual({ type: 'next' })
      expect(nav.index).toBe(0) // index unchanged — it's a semantic action
      expect(nav.handleKeyDown(key('ArrowUp'))).toEqual({ type: 'previous' })
    })
  })

  describe('tree mode', () => {
    it('ArrowRight on collapsed node with children returns expand action', () => {
      const nav = createKeyboardNav({
        count: 5,
        tree: true,
        hasChildren: (i) => i === 0,
        isExpanded: () => false,
      })
      const action = nav.handleKeyDown(key('ArrowRight'))
      expect(action).toEqual({ type: 'expand', target: 0 })
    })

    it('ArrowRight on expanded node returns focus (stay)', () => {
      const nav = createKeyboardNav({
        count: 5,
        tree: true,
        hasChildren: (i) => i === 0,
        isExpanded: () => true,
      })
      const action = nav.handleKeyDown(key('ArrowRight'))
      expect(action).toEqual({ type: 'focus', target: 0 })
    })

    it('ArrowRight on leaf node returns go-to-parent', () => {
      const nav = createKeyboardNav({
        count: 5,
        tree: true,
        hasChildren: () => false,
      })
      const action = nav.handleKeyDown(key('ArrowRight'))
      expect(action).toEqual({ type: 'go-to-parent' })
    })

    it('ArrowLeft on expanded node returns collapse action', () => {
      const nav = createKeyboardNav({
        count: 5,
        tree: true,
        hasChildren: (i) => i === 0,
        isExpanded: () => true,
      })
      const action = nav.handleKeyDown(key('ArrowLeft'))
      expect(action).toEqual({ type: 'collapse', target: 0 })
    })

    it('ArrowLeft on collapsed/leaf node returns go-to-parent', () => {
      const nav = createKeyboardNav({
        count: 5,
        tree: true,
        hasChildren: (i) => i === 0,
        isExpanded: (i) => i !== 0, // index 0 expanded, others not
      })
      // index 1 is collapsed → ArrowLeft → go-to-parent
      nav.focus(1)
      const action = nav.handleKeyDown(key('ArrowLeft'))
      expect(action).toEqual({ type: 'go-to-parent' })
    })
  })

  describe('typeahead', () => {
    it('matches labels on character input', () => {
      const nav = createKeyboardNav({
        count: 4,
        labels: ['Alpha', 'Beta', 'Charlie', 'Delta'],
      })
      // 'b' from Alpha (index 0) → finds Beta (index 1)
      const action = nav.handleKeyDown(key('b'))
      expect(action).toEqual({ type: 'typeahead', target: 1 })
      expect(nav.index).toBe(1)
    })

    it('cycles through same-initial items', () => {
      const nav = createKeyboardNav({
        count: 4,
        labels: ['Apple', 'Avocado', 'Banana', 'Cherry'],
      })
      // 'a' from Apple (index 0) → finds next a-item: Avocado (index 1)
      expect(nav.handleKeyDown(key('a'))).toEqual({ type: 'typeahead', target: 1 })
      // 'a' from Avocado (index 1) → wraps to Apple (index 0)
      expect(nav.handleKeyDown(key('a'))).toEqual({ type: 'typeahead', target: 0 })
    })

    it('accumulates multi-character queries', () => {
      const nav = createKeyboardNav({
        count: 3,
        labels: ['Alpha', 'Alpine', 'Banana'],
      })
      // 'a' from Alpha (0) → Avocado not in list, next a-item: Alpine (1)
      expect(nav.handleKeyDown(key('a'))).toEqual({ type: 'typeahead', target: 1 })
    })

    it('returns noop for no match', () => {
      const nav = createKeyboardNav({
        count: 4,
        labels: ['Alpha', 'Beta', 'Charlie', 'Delta'],
      })
      expect(nav.handleKeyDown(key('z'))).toEqual({ type: 'noop' })
    })

    it('skips disabled items on typeahead', () => {
      const nav = createKeyboardNav({
        count: 4,
        labels: ['Alpha', 'Beta', 'Charlie', 'Delta'],
        isEnabled: (i) => i !== 1, // Beta disabled
      })
      // 'b' should skip Beta (1) and find nothing → noop
      expect(nav.handleKeyDown(key('b'))).toEqual({ type: 'noop' })
    })
  })

  describe('programmatic methods', () => {
    it('move(delta) updates index', () => {
      const nav = createKeyboardNav({ count: 5 })
      nav.move(1)
      expect(nav.index).toBe(1)
      nav.move(1)
      expect(nav.index).toBe(2)
      nav.move(-1)
      expect(nav.index).toBe(1)
    })

    it('goFirst / goLast', () => {
      const nav = createKeyboardNav({ count: 5, initialIndex: 2 })
      nav.goFirst()
      expect(nav.index).toBe(0)
      nav.goLast()
      expect(nav.index).toBe(4)
    })

    it('focus(index) sets the active index (clamped)', () => {
      const nav = createKeyboardNav({ count: 5 })
      nav.focus(3)
      expect(nav.index).toBe(3)
    })

    it('focus(index) clamps to bounds', () => {
      const nav = createKeyboardNav({ count: 5 })
      nav.focus(10)
      // Clamped to last valid index
      expect(nav.index).toBe(4)
      nav.focus(-1)
      expect(nav.index).toBe(-1)
    })

    it('reset() re-anchors when items shrink', () => {
      const nav = createKeyboardNav({ count: 10, initialIndex: 7 })
      nav.reset(5)
      expect(nav.index).toBeLessThan(5)
    })

    it('reset() keeps index when still valid', () => {
      const nav = createKeyboardNav({ count: 10, initialIndex: 3 })
      nav.reset(10)
      expect(nav.index).toBe(3)
    })
  })

  describe('store reactivity', () => {
    it('notifies subscribers on state change', () => {
      const nav = createKeyboardNav({ count: 5 })
      const states: number[] = []
      const unsub = nav.store.subscribe((s) => {
        states.push(s)
      })
      nav.move(1)
      expect(states).toEqual([1])
      nav.move(1)
      expect(states).toEqual([1, 2])
      unsub()
    })

    it('subscribeWith filters to the index slice', () => {
      const nav = createKeyboardNav({ count: 5 })
      const slices: number[] = []
      const unsub = nav.store.subscribeWith(
        (s) => s,
        (s) => {
          slices.push(s)
        },
      )
      nav.focus(3)
      expect(slices).toEqual([3])
      unsub()
    })
  })

  describe('noop for unhandled keys', () => {
    it('returns noop for unhandled keys', () => {
      const nav = createKeyboardNav({ count: 5 })
      expect(nav.handleKeyDown(key('Tab'))).toEqual({ type: 'noop' })
      expect(nav.handleKeyDown(key('F5'))).toEqual({ type: 'noop' })
    })
  })
})

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TABLE_KEYMAP,
  formatKeyBinding,
  formatKeyBindings,
  matchTableKey,
  normalizeKeymap,
  parseTableKey,
  TABLE_KEY_ACTIONS,
} from './keymap'

describe('parseTableKey', () => {
  it('parses a plain key and modifier combos', () => {
    expect(parseTableKey('F2')).toEqual({ key: 'f2', ctrl: false, shift: false, alt: false })
    expect(parseTableKey('Ctrl+Shift+Z')).toEqual({
      key: 'z',
      ctrl: true,
      shift: true,
      alt: false,
    })
    expect(parseTableKey('Alt+Delete')).toEqual({
      key: 'delete',
      ctrl: false,
      shift: false,
      alt: true,
    })
  })

  it('normalizes case and accepts Ctrl/Cmd/Meta and Alt/Option synonyms', () => {
    expect(parseTableKey('f3')).toEqual(parseTableKey('F3'))
    expect(parseTableKey('CMD+C')?.ctrl).toBe(true)
    expect(parseTableKey('Meta+c')?.ctrl).toBe(true)
    expect(parseTableKey('option+d')?.alt).toBe(true)
    expect(parseTableKey('ctrl + shift + y')).toEqual({
      key: 'y',
      ctrl: true,
      shift: true,
      alt: false,
    })
  })

  it('rejects 11 invalid key forms (fail-closed → null)', () => {
    const invalid = [
      '',
      '   ',
      'Meta',
      'Ctrl+',
      'Shift+',
      'Alt+',
      'Ctrl+Shift+',
      'Option+',
      '++',
      'Ctrl++',
      'F3+F4',
    ]
    for (const spec of invalid) {
      expect(parseTableKey(spec), spec).toBeNull()
    }
  })
})

describe('DEFAULT_TABLE_KEYMAP', () => {
  it('covers all 8 actions with the documented defaults + aliases', () => {
    expect(TABLE_KEY_ACTIONS).toEqual([
      'edit',
      'clear',
      'undo',
      'redo',
      'copy',
      'paste',
      'fill',
      'query',
    ])
    expect(DEFAULT_TABLE_KEYMAP).toEqual({
      edit: ['F2'],
      clear: ['Delete', 'Backspace'],
      undo: ['Ctrl+Z'],
      redo: ['Ctrl+Y', 'Ctrl+Shift+Z'],
      copy: ['Ctrl+C'],
      paste: ['Ctrl+V'],
      fill: ['Ctrl+D'],
      query: ['Ctrl+K'],
    })
  })
})

describe('normalizeKeymap', () => {
  it('normalizes every default action (aliases expanded)', () => {
    const km = normalizeKeymap()
    expect(km.edit).toEqual([{ key: 'f2', ctrl: false, shift: false, alt: false }])
    expect(km.clear).toHaveLength(2)
    expect(km.clear!.map((b) => b.key)).toEqual(['delete', 'backspace'])
    expect(km.redo).toHaveLength(2)
    expect(km.redo).toContainEqual({ key: 'z', ctrl: true, shift: true, alt: false })
    expect(km.fill).toEqual([{ key: 'd', ctrl: true, shift: false, alt: false }])
    expect(km.query).toEqual([{ key: 'k', ctrl: true, shift: false, alt: false }])
  })

  it('merges an override per action, leaving every other action untouched', () => {
    const km = normalizeKeymap({ edit: 'F3' })
    expect(km.edit).toEqual([{ key: 'f3', ctrl: false, shift: false, alt: false }])
    expect(km.clear).toEqual(normalizeKeymap().clear)
    expect(km.undo).toEqual(normalizeKeymap().undo)
    expect(km.fill).toEqual(normalizeKeymap().fill)
  })

  it('wholesale alias replacement: an override drops the default aliases', () => {
    expect(normalizeKeymap({ clear: 'Delete' }).clear!.map((b) => b.key)).toEqual(['delete'])
    expect(normalizeKeymap({ redo: 'Ctrl+Y' }).redo!.map((b) => b.key)).toEqual(['y'])
  })

  it('invalid overrides are dropped fail-closed → the action keeps its default', () => {
    const km = normalizeKeymap({ edit: '', clear: '  ', undo: 'Meta', redo: 'Ctrl+' })
    expect(km.edit).toEqual(normalizeKeymap().edit)
    expect(km.clear).toEqual(normalizeKeymap().clear)
    expect(km.undo).toEqual(normalizeKeymap().undo)
    expect(km.redo).toEqual(normalizeKeymap().redo)
    // A valid override mixed with an invalid one still applies.
    const mixed = normalizeKeymap({ edit: 'F3', clear: '' })
    expect(mixed.edit).toEqual([{ key: 'f3', ctrl: false, shift: false, alt: false }])
    expect(mixed.clear).toEqual(normalizeKeymap().clear)
  })
})

describe('formatKeyBinding', () => {
  it('renders plain keys display-cased (F2 / Delete / Space)', () => {
    expect(formatKeyBinding(parseTableKey('F2')!)).toBe('F2')
    expect(formatKeyBinding(parseTableKey('Delete')!)).toBe('Delete')
    expect(formatKeyBinding(parseTableKey('Backspace')!)).toBe('Backspace')
    expect(formatKeyBinding(parseTableKey('Space')!)).toBe('Space')
  })

  it('renders modifiers in Ctrl/Shift/Alt order with the key uppercased', () => {
    expect(formatKeyBinding(parseTableKey('Ctrl+Shift+Z')!)).toBe('Ctrl+Shift+Z')
    expect(formatKeyBinding(parseTableKey('Alt+d')!)).toBe('Alt+D')
    expect(formatKeyBinding(parseTableKey('Shift+Ctrl+Y')!)).toBe('Ctrl+Shift+Y')
    expect(formatKeyBinding(parseTableKey('Option+Alt+F2')!)).toBe('Alt+F2')
  })

  it('renders the shared ctrl-or-meta flag as Ctrl (Meta matches too)', () => {
    expect(formatKeyBinding(parseTableKey('Cmd+C')!)).toBe('Ctrl+C')
    expect(formatKeyBinding(parseTableKey('Meta+K')!)).toBe('Ctrl+K')
  })
})

describe('formatKeyBindings', () => {
  it('joins aliases with a spaced slash and formats the whole default map', () => {
    const km = normalizeKeymap()
    expect(formatKeyBindings(km.edit)).toBe('F2')
    expect(formatKeyBindings(km.clear)).toBe('Delete / Backspace')
    expect(formatKeyBindings(km.undo)).toBe('Ctrl+Z')
    expect(formatKeyBindings(km.redo)).toBe('Ctrl+Y / Ctrl+Shift+Z')
    expect(formatKeyBindings(km.copy)).toBe('Ctrl+C')
    expect(formatKeyBindings(km.paste)).toBe('Ctrl+V')
    expect(formatKeyBindings(km.fill)).toBe('Ctrl+D')
    expect(formatKeyBindings(km.query)).toBe('Ctrl+K')
  })

  it('renders an empty list as an empty string', () => {
    expect(formatKeyBindings([])).toBe('')
  })

  it('round-trips a rebind end-to-end (override → formatted display)', () => {
    const km = normalizeKeymap({ edit: 'Space', query: 'Ctrl+J' })
    expect(formatKeyBindings(km.edit)).toBe('Space')
    expect(formatKeyBindings(km.query)).toBe('Ctrl+J')
  })
})

describe('matchTableKey', () => {
  it('matches the default undo/redo bindings with exact modifiers', () => {
    const km = normalizeKeymap()
    expect(matchTableKey({ key: 'z', ctrlKey: true }, km.undo)).toBe(true)
    // Ctrl+Shift+Z hits redo, never undo (exact match).
    expect(matchTableKey({ key: 'z', ctrlKey: true, shiftKey: true }, km.undo)).toBe(false)
    expect(matchTableKey({ key: 'z', ctrlKey: true, shiftKey: true }, km.redo)).toBe(true)
    expect(matchTableKey({ key: 'y', ctrlKey: true }, km.redo)).toBe(true)
  })

  it('Ctrl = ctrl-or-meta (Meta matches a Ctrl binding, neither does not)', () => {
    const km = normalizeKeymap()
    expect(matchTableKey({ key: 'z', metaKey: true }, km.undo)).toBe(true)
    expect(matchTableKey({ key: 'c', metaKey: true }, km.copy)).toBe(true)
    expect(matchTableKey({ key: 'z' }, km.undo)).toBe(false)
    expect(matchTableKey({ key: 'z', ctrlKey: true, metaKey: true }, km.undo)).toBe(true)
  })

  it('shift/alt flags match exactly (bare F2 never fires with Shift; Alt+Ctrl+Z inert)', () => {
    const km = normalizeKeymap()
    expect(matchTableKey({ key: 'F2' }, km.edit)).toBe(true)
    expect(matchTableKey({ key: 'F2', shiftKey: true }, km.edit)).toBe(false)
    expect(matchTableKey({ key: 'f2' }, km.edit)).toBe(true) // case-insensitive
    expect(matchTableKey({ key: 'z', ctrlKey: true, altKey: true }, km.undo)).toBe(false)
    expect(matchTableKey({ key: 'z', ctrlKey: true, altKey: true }, km.redo)).toBe(false)
    expect(matchTableKey({ key: 'd', ctrlKey: true }, km.fill)).toBe(true)
    expect(matchTableKey({ key: 'd', ctrlKey: true, shiftKey: true }, km.fill)).toBe(false)
  })

  it('a rebinding is honored end-to-end and space keys normalize', () => {
    const km = normalizeKeymap({ edit: 'Space', query: 'Ctrl+J' })
    expect(matchTableKey({ key: ' ' }, km.edit)).toBe(true)
    expect(matchTableKey({ key: 'F2' }, km.edit)).toBe(false)
    expect(matchTableKey({ key: 'j', ctrlKey: true }, km.query)).toBe(true)
    expect(matchTableKey({ key: 'k', ctrlKey: true }, km.query)).toBe(false)
  })
})

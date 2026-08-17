import { describe, expect, it } from 'vitest'
import { compareStates } from './compareStates'

describe('compareStates — identity & key-order independence', () => {
  it('returns an empty string for byte-identical inputs', () => {
    expect(
      compareStates(
        '{"pageSize":25,"sort":{"column":"age","direction":"asc"}}',
        '{"pageSize":25,"sort":{"column":"age","direction":"asc"}}',
      ),
    ).toBe('')
  })

  it('is order-independent (structural deep-equal by sorted keys)', () => {
    const a = '{"admin":true,"active":false,"name":"x"}'
    const b = '{"name":"x","active":false,"admin":true}'
    expect(compareStates(a, b)).toBe('')
  })

  it('treats a reordered array as a change (elementwise by index)', () => {
    expect(compareStates('{"columnOrder":["age","name"]}', '{"columnOrder":["name","age"]}')).toBe(
      '~ columnOrder[0]: "age" → "name"\n~ columnOrder[1]: "name" → "age"',
    )
  })
})

describe('compareStates — diff output', () => {
  it('reports a root scalar change (numbers bare, strings quoted)', () => {
    expect(compareStates('{"pageSize":25}', '{"pageSize":50}')).toBe('~ pageSize: 25 → 50')
  })

  it('descends into object blocks via dot-paths', () => {
    expect(
      compareStates(
        '{"sort":{"column":"age","direction":"asc"}}',
        '{"sort":{"column":"age","direction":"desc"}}',
      ),
    ).toBe('~ sort.direction: "asc" → "desc"')
  })

  it('reports record-map changes per key', () => {
    expect(compareStates('{"columnWidths":{"name":120}}', '{"columnWidths":{"name":160}}')).toBe(
      '~ columnWidths.name: 120 → 160',
    )
  })

  it('reports arrays elementwise by index', () => {
    expect(compareStates('{"columnOrder":["age","name"]}', '{"columnOrder":["age"]}')).toBe(
      '- columnOrder[1]: "name"',
    )
  })

  it('reports added and removed keys with + and - symbols', () => {
    expect(compareStates('{"a":1,"gone":"x"}', '{"a":1,"added":true}')).toBe(
      '+ added: true\n- gone: "x"',
    )
  })

  it('emits multiple sibling blocks in deterministic sorted-key order', () => {
    const out = compareStates(
      '{"pageSize":25,"sort":{"direction":"asc"},"query":"q"}',
      '{"pageSize":25,"sort":{"direction":"desc"},"query":"q"}',
    )
    expect(out).toBe('~ sort.direction: "asc" → "desc"')
  })

  it('emits several sorted paths together, ordered by key iteration', () => {
    const a = '{"z":0,"pageSize":25,"a":1}'
    const b = '{"z":1,"pageSize":50,"a":1}'
    expect(compareStates(a, b)).toBe('~ pageSize: 25 → 50\n~ z: 0 → 1')
  })

  it('reports a scalar whose type changes across the comparison', () => {
    expect(compareStates('{"pageSize":25}', '{"pageSize":"big"}')).toBe('~ pageSize: 25 → "big"')
  })
})

describe('compareStates — fail-closed & orientation', () => {
  it('never throws and returns the literal error string for invalid JSON', () => {
    expect(compareStates('{not json', '{}')).toBe('! compareStates: invalid JSON')
    expect(compareStates('{}', '[unclosed')).toBe('! compareStates: invalid JSON')
    expect(() => compareStates('nope', 'nope2')).not.toThrow()
  })

  it('orientation is a=before, b=after (arrow reads old → new)', () => {
    const forward = compareStates('{"v":1}', '{"v":2}')
    const backward = compareStates('{"v":2}', '{"v":1}')
    expect(forward).toBe('~ v: 1 → 2')
    expect(backward).toBe('~ v: 2 → 1')
  })

  it('added/removed keys are directional too', () => {
    expect(compareStates('{}', '{"v":1}')).toBe('+ v: 1')
    expect(compareStates('{"v":1}', '{}')).toBe('- v: 1')
  })
})

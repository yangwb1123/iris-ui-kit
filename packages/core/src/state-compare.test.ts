import { describe, expect, it } from 'vitest'
import { compareStates } from './state-compare'

describe('compareStates', () => {
  it('is structural for objects but positional for arrays', () => {
    expect(compareStates('{"b":2,"a":{"x":1}}', '{"a":{"x":1},"b":2}')).toBe('')
    expect(compareStates('{"order":["a","b"]}', '{"order":["b","a"]}')).toBe(
      '~ order[0]: "a" → "b"\n~ order[1]: "b" → "a"',
    )
  })

  it('reports sorted additions, removals, and nested changes', () => {
    expect(
      compareStates(
        '{"pageSize":25,"sort":{"direction":"asc"},"gone":"x"}',
        '{"pageSize":50,"sort":{"direction":"desc"},"added":true}',
      ),
    ).toBe('+ added: true\n- gone: "x"\n~ pageSize: 25 → 50\n~ sort.direction: "asc" → "desc"')
  })

  it('fails closed on invalid JSON and never throws', () => {
    expect(compareStates('{bad', '{}')).toBe('! compareStates: invalid JSON')
    expect(() => compareStates('nope', 'still nope')).not.toThrow()
  })
})

import { describe, expect, it } from 'vitest'
import { resolveDataState } from './data-state'

describe('resolveDataState', () => {
  it('returns "content" when no flags are set', () => {
    expect(resolveDataState({})).toBe('content')
  })

  it('returns "empty" when empty and nothing higher', () => {
    expect(resolveDataState({ empty: true })).toBe('empty')
  })

  it('returns "loading" over empty', () => {
    expect(resolveDataState({ loading: true, empty: true })).toBe('loading')
  })

  it('returns "error" over loading and empty (highest precedence)', () => {
    expect(resolveDataState({ error: true, loading: true, empty: true })).toBe('error')
  })

  it('content wins when empty is false even with data absent flags off', () => {
    expect(resolveDataState({ loading: false, error: false, empty: false })).toBe('content')
  })

  it('stale-while-revalidate: loading + hasContent shows content, not a spinner', () => {
    expect(resolveDataState({ loading: true, hasContent: true })).toBe('content')
  })

  it('stale-while-revalidate: a retry over existing content keeps content, not the stale error', () => {
    expect(resolveDataState({ loading: true, error: true, hasContent: true })).toBe('content')
  })

  it('hasContent without loading does not change base precedence', () => {
    expect(resolveDataState({ error: true, hasContent: true })).toBe('error')
    expect(resolveDataState({ empty: true, hasContent: true })).toBe('empty')
  })
})

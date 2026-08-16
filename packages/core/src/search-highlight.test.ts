import { describe, expect, it } from 'vitest'
import { splitSearchHits } from './search-highlight'

describe('splitSearchHits', () => {
  it('splits one hit into [plain, hit, tail]', () => {
    expect(splitSearchHits('hello world', 'world')).toEqual(['hello ', 'world', ''])
  })

  it('is case-insensitive but preserves the original casing', () => {
    expect(splitSearchHits('Hello World', 'world')).toEqual(['Hello ', 'World', ''])
    expect(splitSearchHits('hello world', 'HELLO')).toEqual(['', 'hello', ' world'])
  })

  it('splits every occurrence (multi-hit, alternating)', () => {
    expect(splitSearchHits('banana', 'an')).toEqual(['b', 'an', '', 'an', 'a'])
  })

  it('is non-overlapping — aaa + aa = one hit (fnr replace-all gi parity)', () => {
    expect(splitSearchHits('aaa', 'aa')).toEqual(['', 'aa', 'a'])
  })

  it('keeps adjacent hits adjacent with an empty plain gap', () => {
    expect(splitSearchHits('aaaa', 'aa')).toEqual(['', 'aa', '', 'aa', ''])
  })

  it('returns null on no match', () => {
    expect(splitSearchHits('hello world', 'xyz')).toBeNull()
  })

  it('returns null on an empty query', () => {
    expect(splitSearchHits('hello', '')).toBeNull()
  })

  it('returns null on an empty text', () => {
    expect(splitSearchHits('', 'a')).toBeNull()
  })

  it('splits CJK text by character spans', () => {
    expect(splitSearchHits('你好世界', '世界')).toEqual(['你好', '世界', ''])
  })

  it('treats regex metacharacters literally (no regex interpretation)', () => {
    expect(splitSearchHits('a.b*c', '.b*')).toEqual(['a', '.b*', 'c'])
    expect(splitSearchHits('cost (5)', '(5)')).toEqual(['cost ', '(5)', ''])
  })

  it('matches the whole text as a single hit', () => {
    expect(splitSearchHits('abc', 'abc')).toEqual(['', 'abc', ''])
  })
})

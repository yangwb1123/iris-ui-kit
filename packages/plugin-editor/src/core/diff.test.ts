import { describe, it, expect } from 'vitest'
import { computeDiff } from './diff'

describe('computeDiff', () => {
  it('identical texts are all unchanged', () => {
    const result = computeDiff('a\nb\nc', 'a\nb\nc')
    expect(result.every((d) => d.kind === 'unchanged')).toBe(true)
    expect(result).toHaveLength(3)
  })

  it('empty base marks all lines as added', () => {
    const result = computeDiff('a\nb', '')
    expect(result.every((d) => d.kind === 'added')).toBe(true)
    expect(result).toHaveLength(2)
  })

  it('added lines are detected', () => {
    const result = computeDiff('a\nb\nc', 'a\nc')
    const added = result.filter((d) => d.kind === 'added')
    expect(added).toHaveLength(1)
    expect(added[0].line).toBe(2)
  })

  it('modified text shows changed lines', () => {
    const result = computeDiff('a\nx\nc', 'a\nb\nc')
    const added = result.filter((d) => d.kind === 'added')
    expect(added).toHaveLength(1)
    expect(added[0].line).toBe(2)
  })

  it('identical texts are all unchanged', () => {
    const result = computeDiff('a\nb', 'a\nb')
    expect(result.every((d) => d.kind === 'unchanged')).toBe(true)
  })

  it('partial change shows mix of unchanged and added', () => {
    const result = computeDiff('a\ny\nc', 'a\nx\nc')
    expect(result.some((d) => d.kind === 'unchanged')).toBe(true)
    expect(result.some((d) => d.kind === 'added')).toBe(true)
  })

  it('single-line change', () => {
    const result = computeDiff('b', 'a')
    expect(result).toHaveLength(1)
    expect(result[0]?.kind).toBe('added')
  })
})

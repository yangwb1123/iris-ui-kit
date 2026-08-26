import { describe, it, expect, vi } from 'vitest'
import {
  createTreeSelection,
  flattenTreeSelectionNodes,
  type TreeSelectionNode,
} from './tree-selection'

//   root
//   ├─ a            (branch)
//   │  ├─ a1        (leaf)
//   │  └─ a2        (leaf)
//   └─ b            (branch)
//      ├─ b1        (leaf)
//      └─ b2        (leaf, disabled)
const nodes: TreeSelectionNode[] = [
  { key: 'root' },
  { key: 'a', parentKey: 'root' },
  { key: 'a1', parentKey: 'a' },
  { key: 'a2', parentKey: 'a' },
  { key: 'b', parentKey: 'root' },
  { key: 'b1', parentKey: 'b' },
  { key: 'b2', parentKey: 'b', disabled: true },
]

describe('createTreeSelection — cascade', () => {
  it('checking a branch checks all its (enabled) leaves', () => {
    const t = createTreeSelection({ nodes })
    t.check('a')
    expect(t.isChecked('a1')).toBe(true)
    expect(t.isChecked('a2')).toBe(true)
    expect(t.isChecked('a')).toBe(true)
  })

  it('toggle a leaf bubbles ancestor state to checked/indeterminate/unchecked', () => {
    const t = createTreeSelection({ nodes })
    t.check('a1')
    expect(t.isChecked('a')).toBe(false)
    expect(t.isIndeterminate('a')).toBe(true)
    expect(t.isIndeterminate('root')).toBe(true)
    t.check('a2')
    expect(t.isChecked('a')).toBe(true)
    expect(t.isIndeterminate('a')).toBe(false)
    t.uncheck('a1')
    t.uncheck('a2')
    expect(t.isChecked('a')).toBe(false)
    expect(t.isIndeterminate('a')).toBe(false)
  })

  it('disabled leaves are excluded from the cascade', () => {
    const t = createTreeSelection({ nodes })
    t.check('b')
    expect(t.isChecked('b1')).toBe(true)
    expect(t.isChecked('b2')).toBe(false) // disabled — not cascaded
    // b has one enabled checked leaf and one disabled unchecked → 'b' is checked
    // because all NON-disabled leaves count; b2 is excluded from the leaf set.
    expect(t.isChecked('b')).toBe(true)
  })

  it('getChecked includes fully-checked branches; getCheckedLeaves is leaves only', () => {
    const t = createTreeSelection({ nodes })
    t.check('a')
    expect(t.getCheckedLeaves().sort()).toEqual(['a1', 'a2'])
    expect(t.getChecked().sort()).toEqual(['a', 'a1', 'a2'])
  })

  it('fires onChange with the reconciled checked set', () => {
    const onChange = vi.fn()
    const t = createTreeSelection({ nodes, onChange })
    t.check('a1')
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('a1')
  })

  it('defaultChecked seeds through the cascade', () => {
    const t = createTreeSelection({ nodes, defaultChecked: ['a'] })
    expect(t.isChecked('a1')).toBe(true)
    expect(t.isChecked('a2')).toBe(true)
  })

  it('numeric keys work', () => {
    const t = createTreeSelection<number>({
      nodes: [{ key: 1 }, { key: 2, parentKey: 1 }, { key: 3, parentKey: 1 }],
    })
    t.check(1)
    expect(t.isChecked(2)).toBe(true)
    expect(t.isChecked(3)).toBe(true)
  })

  it('handles an unknown parentKey as a root (no crash)', () => {
    const t = createTreeSelection({
      nodes: [{ key: 'x', parentKey: 'ghost' }],
    })
    t.check('x')
    expect(t.isChecked('x')).toBe(true)
  })

  it('is cycle-guarded (malformed self/loop parentage does not hang)', () => {
    const t = createTreeSelection({
      nodes: [
        { key: 'p', parentKey: 'q' },
        { key: 'q', parentKey: 'p' },
      ],
    })
    expect(() => t.check('p')).not.toThrow()
  })

  it('flattens nested rows with global indexes and cycle/duplicate guards', () => {
    type Row = { id?: string; children?: Row[]; disabled?: boolean }
    const root: Row = { children: [] }
    const child: Row = { id: 'child', disabled: true }
    const duplicate: Row = { id: 'child' }
    root.children = [child]
    child.children = [root]

    const rows = flattenTreeSelectionNodes([root, duplicate], {
      getKey: (row, index) => row.id ?? `index-${index}`,
      getChildren: (row) => row.children,
      isDisabled: (row) => row.disabled === true,
    })

    expect(rows).toEqual([
      { key: 'index-0', parentKey: undefined },
      { key: 'child', parentKey: 'index-0', disabled: true },
    ])
  })
})

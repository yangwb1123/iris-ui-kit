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

  it('keeps getters reconciled when the underlying selection is set directly', () => {
    const t = createTreeSelection({
      nodes: [{ key: 'branch' }, { key: 'leaf', parentKey: 'branch' }],
    })
    t.selection.set(['branch', 'leaf', 'ghost'])

    expect(t.isChecked('branch')).toBe(true)
    expect(t.getCheckedLeaves()).toEqual(['leaf'])
    expect(t.getChecked()).toEqual(['leaf', 'branch'])
  })

  it('fires onChange with the reconciled checked set', () => {
    const onChange = vi.fn()
    const t = createTreeSelection({ nodes, onChange })
    t.check('a1')
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('a1')
  })

  it('keeps reentrant onChange snapshots independent', () => {
    const changes: string[][] = []
    const t = createTreeSelection({
      nodes: [{ key: 'a' }, { key: 'b' }],
      onChange(keys) {
        changes.push(keys)
        if (keys.length === 1) t.check('b')
      },
    })

    t.check('a')
    expect(changes).toEqual([['a'], ['a', 'b']])
    changes[0]!.push('polluted')
    expect(t.getChecked()).toEqual(['a', 'b'])
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

  it('preserves SameValueZero keys, leaf order, and result identity', () => {
    const t = createTreeSelection<string | number>({
      nodes: [
        { key: NaN },
        { key: Infinity, parentKey: NaN },
        { key: 0, parentKey: NaN },
        { key: '0', parentKey: NaN },
      ],
    })

    t.check(NaN)
    expect(t.getCheckedLeaves()).toEqual([Infinity, 0, '0'])
    expect(t.getChecked()).toEqual([Infinity, 0, '0', NaN])
    expect(t.isChecked(NaN)).toBe(true)
    expect(t.isChecked(0)).toBe(true)
    expect(t.isChecked('0')).toBe(true)

    const leaves = t.getCheckedLeaves()
    const checked = t.getChecked()
    leaves.pop()
    checked.splice(0, checked.length)
    expect(t.getCheckedLeaves()).toEqual([Infinity, 0, '0'])
    expect(t.getChecked()).toEqual([Infinity, 0, '0', NaN])
  })

  it('handles an unknown parentKey as a root (no crash)', () => {
    const t = createTreeSelection({
      nodes: [{ key: 'x', parentKey: 'ghost' }],
    })
    t.check('x')
    expect(t.isChecked('x')).toBe(true)
  })

  it('fails closed for unknown, empty, and disabled keys without no-op events', () => {
    const onChange = vi.fn()
    const t = createTreeSelection({
      nodes: [{ key: 'enabled' }, { key: 'disabled', disabled: true }],
      defaultChecked: ['ghost'],
      onChange,
    })
    const storeChanges: string[][] = []
    t.selection.store.subscribe((keys) => storeChanges.push(keys))

    expect(t.getCheckedLeaves()).toEqual([])
    expect(t.isChecked('ghost')).toBe(false)
    const emptyChange = vi.fn()
    const empty = createTreeSelection({ nodes: [], onChange: emptyChange })
    empty.toggle('ghost')
    expect(empty.getChecked()).toEqual([])
    expect(emptyChange).not.toHaveBeenCalled()
    t.check('ghost')
    t.toggle('ghost')
    t.uncheck('ghost')
    t.check('disabled')
    t.uncheck('disabled')

    expect(onChange).not.toHaveBeenCalled()
    expect(storeChanges).toEqual([])

    t.check('enabled')
    t.check('enabled')
    t.uncheck('enabled')
    t.uncheck('enabled')
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(storeChanges).toHaveLength(2)
  })

  it('does not cascade through a disabled branch', () => {
    const t = createTreeSelection({
      nodes: [
        { key: 'root' },
        { key: 'blocked', parentKey: 'root', disabled: true },
        { key: 'blocked-leaf', parentKey: 'blocked' },
        { key: 'live-leaf', parentKey: 'root' },
      ],
    })

    t.check('root')
    expect(t.isChecked('live-leaf')).toBe(true)
    expect(t.isChecked('blocked-leaf')).toBe(false)
    expect(t.isChecked('root')).toBe(true)

    // An enabled leaf can still be addressed directly, but an ancestor
    // cascade must not clear it through the disabled branch.
    t.check('blocked-leaf')
    t.uncheck('root')
    expect(t.isChecked('blocked-leaf')).toBe(true)
  })

  it('ignores duplicate flat definitions and keeps the first definition', () => {
    const t = createTreeSelection({
      nodes: [
        { key: 'root' },
        { key: 'duplicate', parentKey: 'root' },
        { key: 'duplicate', parentKey: 'duplicate' },
        { key: 'sibling', parentKey: 'root' },
      ],
    })

    t.check('root')
    expect(t.getCheckedLeaves()).toEqual(['duplicate', 'sibling'])
  })

  it('owns a snapshot of flat node definitions', () => {
    const child: TreeSelectionNode = { key: 'child', parentKey: 'root' }
    const input: TreeSelectionNode[] = [{ key: 'root' }, child]
    const t = createTreeSelection({ nodes: input })

    child.disabled = true
    input.push({ key: 'later', parentKey: 'root' })
    t.check('root')

    expect(t.getCheckedLeaves()).toEqual(['child'])
    expect(t.isChecked('later')).toBe(false)
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

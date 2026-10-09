import { describe, expect, it, vi } from 'vitest'
import { createGridRowsModel, setTreeChildren, type GridRowsModel } from './grid'

type Row = { id?: number; name?: string; children?: Row[]; descendants?: Row[] }
const getChildren = (row: Row) => row.children

describe('grid rows edge transactions', () => {
  it('falls back to traversal for missing field keys and preserves unkeyed rows', () => {
    const unkeyed: Row = { name: 'unkeyed' }
    const first: Row = { id: 1, name: 'first' }
    const second: Row = { id: 2, name: 'second' }
    const onRowsChange = vi.fn()
    const model = createGridRowsModel<Row>({ defaultRows: [unkeyed, first, second], onRowsChange })
    expect(model.find(1)).toBe(first)
    expect(model.find(99)).toBeUndefined()
    expect(model.remove(99)).toBe(false)
    expect(model.update(99, { name: 'missing' })).toBe(false)
    expect(onRowsChange).not.toHaveBeenCalled()
    expect(model.remove(1)).toBe(true)
    expect(model.get()).toEqual([unkeyed, second])
    expect(model.update(2, { name: 'updated' })).toBe(true)
    expect(model.get()).toEqual([unkeyed, { id: 2, name: 'updated' }])
    expect(model.get()[0]).toBe(unkeyed)
    expect(second.name).toBe('second')
    expect(onRowsChange).toHaveBeenLastCalledWith({
      previousRows: [unkeyed, second],
      rows: [unkeyed, { id: 2, name: 'updated' }],
      reason: 'edit',
      meta: undefined,
    })
  })

  it('keeps indexed missing-key operations silent and removes a key only once', () => {
    const first = { id: 1, name: 'first' }
    const second = { id: 2, name: 'second' }
    const event = vi.fn()
    const model = createGridRowsModel<Row>({ defaultRows: [first, second] }, event)
    const original = model.store.getState()
    expect(model.remove(99)).toBe(false)
    expect(model.update(99, { name: 'missing' })).toBe(false)
    expect(model.removeMany([99])).toEqual([])
    expect(model.store.getState()).toBe(original)
    expect(event).not.toHaveBeenCalled()
    const meta = { source: 'selection' }
    expect(model.removeMany([2, 99, 2], { meta })).toEqual([2])
    expect(model.get()).toEqual([first])
    expect(event).toHaveBeenCalledWith({
      previousRows: [first, second],
      rows: [first],
      reason: 'remove',
      meta,
    })
    expect(model.clear()).toBe(true)
    const empty = model.store.getState()
    expect(model.clear()).toBe(false)
    expect(model.store.getState()).toBe(empty)
    expect(model.getData()).toEqual([])
  })

  it('accepts same-length updater changes and copies inputs while sync stays silent', () => {
    const first = { id: 1, name: 'first' }
    const second = { id: 2, name: 'second' }
    const seed = [first, second]
    const event = vi.fn()
    const model = createGridRowsModel<Row>({ defaultRows: seed }, event)
    let working: readonly Row[] | undefined
    expect(
      model.transact((rows) => {
        working = rows
        return [rows[1], rows[0]]
      }),
    ).toBe(true)
    expect(working).not.toBe(seed)
    expect(model.get()).toEqual([second, first])
    expect(seed).toEqual([first, second])
    expect(event).toHaveBeenCalledWith({
      previousRows: [first, second],
      rows: [second, first],
      reason: 'set',
      meta: undefined,
    })
    const reordered = model.store.getState()
    expect(model.transact((rows) => [...rows])).toBe(false)
    expect(model.sync([second, first])).toBe(false)
    expect(model.store.getState()).toBe(reordered)
    event.mockClear()
    const replacement = { id: 1, name: 'remote' }
    const remote = [second, replacement]
    expect(model.sync(remote)).toBe(true)
    remote.pop()
    expect(model.get()).toEqual([second, replacement])
    expect(event).not.toHaveBeenCalled()
    expect(model.sync([])).toBe(true)
    expect(model.get()).toEqual([])
  })

  it('resolves computed positions against the current list and rejects missing keys', () => {
    const first = { name: 'first' }
    const second = { name: 'second' }
    const model = createGridRowsModel<Row>({
      defaultRows: [first, second],
      getRowKey: (_, index) => index,
    })
    expect(model.find(0)).toBe(first)
    expect(model.find(99)).toBeUndefined()
    expect(model.remove(99)).toBe(false)
    expect(model.update(99, { name: 'missing' })).toBe(false)
    expect(model.transact((rows) => [rows[1], rows[0]])).toBe(true)
    expect(model.find(0)).toBe(second)
    expect(model.update(0, { name: 'changed' })).toBe(true)
    expect(model.get()).toEqual([{ name: 'changed' }, first])
    expect(model.remove(1)).toBe(true)
    expect(model.get()).toEqual([{ name: 'changed' }])
    expect(second.name).toBe('second')
  })

  it.each([false, true])(
    'returns no removed keys when an observer attempts reentry (tree: %s)',
    (tree) => {
      const child: Row = { id: 2 }
      const root: Row = tree ? { id: 1, children: [child] } : { id: 1 }
      const seed = tree ? [root] : [root, child]
      let rejected: readonly (string | number)[] | undefined
      const event = vi.fn()
      const model: GridRowsModel<Row> = createGridRowsModel<Row>(
        {
          defaultRows: seed,
          getChildren: tree ? getChildren : undefined,
          onBeforeRowsChange: () => {
            rejected = model.removeMany([2])
          },
        },
        event,
      )
      const replacement = { ...root, name: 'loaded' }
      const next = tree ? [replacement] : [replacement, child]
      expect(model.loadData(next)).toBe(true)
      expect(rejected).toEqual([])
      expect(model.get()).toEqual(next)
      expect(model.find(2)).toBe(child)
      expect(event).toHaveBeenCalledExactlyOnceWith({
        previousRows: seed,
        rows: next,
        reason: 'load',
        meta: undefined,
      })
    },
  )

  it('removes tree subtrees immutably and reports requested keys before other descendants', () => {
    const leaf: Row = { id: 3 }
    const otherLeaf: Row = { id: 4 }
    const child: Row = { id: 2, children: [leaf, otherLeaf] }
    const root: Row = { id: 1, children: [child] }
    const sibling: Row = { id: 5 }
    const event = vi.fn()
    const model = createGridRowsModel<Row>({ defaultRows: [root, sibling], getChildren }, event)
    expect(model.remove(99)).toBe(false)
    expect(event).not.toHaveBeenCalled()
    expect(model.remove(5)).toBe(true)
    expect(model.get()).toEqual([root])
    expect(model.removeMany([2, 3, 2, 99])).toEqual([2, 3, 4])
    expect(model.get()).toEqual([{ id: 1, children: [] }])
    expect(root.children).toEqual([child])
    expect(child.children).toEqual([leaf, otherLeaf])
    expect(model.find(3)).toBeUndefined()
    expect(event).toHaveBeenLastCalledWith({
      previousRows: [root],
      rows: [{ id: 1, children: [] }],
      reason: 'remove',
      meta: undefined,
    })
  })

  it('blocks single-row removal from ambiguous trees', () => {
    const child: Row = { id: 2 }
    const root: Row = { id: 1, children: [child, { id: 2 }] }
    const event = vi.fn()
    const model = createGridRowsModel<Row>({ defaultRows: [root], getChildren }, event)
    const original = model.store.getState()
    expect(model.remove(2)).toBe(false)
    expect(model.store.getState()).toBe(original)
    expect(root.children).toEqual([child, { id: 2 }])
    expect(event).not.toHaveBeenCalled()
  })
})

describe('grid child hydration write boundaries', () => {
  it('copies lazy children and infers direct child properties through an ancestor path', () => {
    const child: Row = { id: 2, children: undefined }
    const sibling: Row = { id: 3 }
    const root: Row = { id: 1, children: undefined }
    const unrelated: Row = { id: 9 }
    const event = vi.fn()
    const model = createGridRowsModel<Row>({ defaultRows: [root, unrelated], getChildren }, event)
    const children = [child, sibling]
    expect(model.setChildren(1, children)).toBe(true)
    children.pop()
    expect(model.get()[0].children).toEqual([child, sibling])
    expect(root.children).toBeUndefined()
    event.mockClear()
    const grandchild: Row = { id: 4 }
    expect(model.setChildren(2, [grandchild])).toBe(true)
    const hydrated = model.get()[0]
    expect(hydrated.children).toEqual([{ id: 2, children: [grandchild] }, sibling])
    expect(hydrated.children?.[0]).not.toBe(child)
    expect(hydrated.children?.[1]).toBe(sibling)
    expect(model.get()[1]).toBe(unrelated)
    expect(child.children).toBeUndefined()
    expect(event).toHaveBeenCalledWith(expect.objectContaining({ reason: 'children' }))
    event.mockClear()
    expect(model.setChildren(2, [grandchild])).toBe(false)
    expect(model.get()[0]).toBe(hydrated)
    expect(model.syncChildren(2, [])).toBe(true)
    expect(model.get()[0].children?.[0].children).toEqual([])
    expect(hydrated.children?.[0].children).toEqual([grandchild])
    expect(event).not.toHaveBeenCalled()
    const settled = model.store.getState()
    expect(model.setChildren(99, [])).toBe(false)
    expect(model.store.getState()).toBe(settled)
  })

  it.each(['target', 'ancestor'])(
    'fails closed when the %s has computed children without a setter',
    (boundary) => {
      const child: Row = boundary === 'ancestor' ? { id: 2, children: [] } : { id: 2 }
      const root: Row = { id: 1 }
      const hidden = new Map<Row, Row[]>([
        [root, [child]],
        [child, []],
      ])
      const event = vi.fn()
      const model = createGridRowsModel<Row>(
        {
          defaultRows: [root],
          getChildren: (row) => row.children ?? hidden.get(row),
        },
        event,
      )
      const original = model.store.getState()
      expect(model.setChildren(2, [{ id: 3 }])).toBe(false)
      expect(model.syncChildren(2, [{ id: 3 }])).toBe(false)
      expect(model.store.getState()).toBe(original)
      expect(hidden.get(root)).toEqual([child])
      expect(hidden.get(child)).toEqual([])
      expect(child.children).toEqual(boundary === 'ancestor' ? [] : undefined)
      expect(event).not.toHaveBeenCalled()
    },
  )

  it('uses custom setters to rebuild computed child lists and retains unrelated roots', () => {
    const child: Row = { id: 2, descendants: [] }
    const root: Row = { id: 1, descendants: [child] }
    const unrelated: Row = { id: 9 }
    const setChildren = vi.fn((row: Row, descendants: Row[]) => ({ ...row, descendants }))
    const model = createGridRowsModel<Row>({
      defaultRows: [root, unrelated],
      getChildren: (row) => row.descendants?.slice(),
      setChildren,
    })
    const grandchild: Row = { id: 3 }
    expect(model.setChildren(2, [grandchild])).toBe(true)
    expect(model.get()[0].descendants).toEqual([{ id: 2, descendants: [grandchild] }])
    expect(model.get()[0]).not.toBe(root)
    expect(model.get()[1]).toBe(unrelated)
    expect(setChildren).toHaveBeenCalledWith(child, [grandchild])
    expect(root.descendants).toEqual([child])
    expect(child.descendants).toEqual([])
  })

  it('rejects child methods on flat models and malformed child lists on tree models', () => {
    const flat = createGridRowsModel<Row>({ defaultRows: [{ id: 1 }] })
    const tree = createGridRowsModel<Row>({ defaultRows: [{ id: 1, children: [] }], getChildren })
    expect(flat.setChildren(1, [])).toBe(false)
    expect(flat.syncChildren(1, [])).toBe(false)
    expect(flat.get()).toEqual([{ id: 1 }])
    const original = tree.store.getState()
    expect(tree.setChildren(1, null as never)).toBe(false)
    expect(tree.syncChildren(1, {} as never)).toBe(false)
    expect(tree.store.getState()).toBe(original)
  })

  it('terminates malformed-tree key searches and distinguishes absent from reachable parents', () => {
    const root: Row = { id: 1 }
    const child: Row = { id: 2 }
    root.children = [child, root]
    const later: Row = { id: 4 }
    const source = [root, later]
    const options = { getRowKey: (row: Row) => row.id, getChildren }
    for (const [key, matched] of [
      [99, false],
      [4, true],
    ] as const) {
      const result = setTreeChildren(source, key, [{ id: 5 }], options)
      expect(result).toEqual({
        rows: source,
        matched,
        changed: false,
        blocked: true,
        removed: new Set(),
      })
      expect(result.rows).toBe(source)
    }
    expect(root.children).toEqual([child, root])
    expect(later.children).toBeUndefined()
  })
})

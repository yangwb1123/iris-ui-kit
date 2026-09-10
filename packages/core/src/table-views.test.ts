import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  readTableViews,
  writeTableViews,
  TABLE_VIEWS_DEFAULT_KEY,
  TABLE_VIEWS_SAVE_ITEM,
  type TableViewSnapshot,
} from './table-views'
function memoryStorage(seed?: string): {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  store: Map<string, string>
} {
  const store = new Map<string, string>()
  if (seed !== undefined) store.set(TABLE_VIEWS_DEFAULT_KEY, seed)
  return {
    store,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
  }
}

describe('TableViewSnapshot shape', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips a full snapshot through write/read', () => {
    const storage = memoryStorage()
    const full: TableViewSnapshot = {
      sort: { key: 'name', direction: 'asc' },
      multiSort: [
        { key: 'name', direction: 'asc' },
        { key: 'age', direction: 'desc' },
      ],
      filters: { status: 'active' },
      filterValues: { status: ['active', 'paused'] },
      columnWidths: { name: 180, age: 80 },
      pageSize: 25,
      expandedRowKeys: ['1', 2],
    }
    writeTableViews({ storage }, [{ name: 'Full', snapshot: full }])
    const views = readTableViews<TableViewSnapshot>({ storage })
    expect(views).toHaveLength(1)
    expect(views[0]!.name).toBe('Full')
    expect(views[0]!.snapshot).toEqual(full)
  })

  it('keeps legacy sort-only snapshots valid and preserves null sort', () => {
    const seed = JSON.stringify([
      { name: 'Legacy', snapshot: { sort: { key: 'age', direction: 'desc' } } },
      { name: 'Cleared', snapshot: { sort: null } },
    ])
    const storage = memoryStorage(seed)
    const views = readTableViews<TableViewSnapshot>({ storage })
    expect(views).toEqual([
      { name: 'Legacy', snapshot: { sort: { key: 'age', direction: 'desc' } } },
      { name: 'Cleared', snapshot: { sort: null } },
    ])
    // A sort-only write stays byte-compatible: no new fields are invented.
    writeTableViews({ storage }, [{ name: 'Legacy', snapshot: views[0]!.snapshot }])
    expect(JSON.parse(storage.store.get(TABLE_VIEWS_DEFAULT_KEY)!)).toEqual([
      { name: 'Legacy', snapshot: { sort: { key: 'age', direction: 'desc' } } },
    ])
  })

  it('sort-only snapshots coexist with extended snapshots in one list', () => {
    const seed = JSON.stringify([
      { name: 'SortOnly', snapshot: { sort: { key: 'a', direction: 'asc' } } },
      {
        name: 'Extended',
        snapshot: { sort: null, multiSort: [{ key: 'b', direction: 'desc' }], pageSize: 50 },
      },
    ])
    const views = readTableViews<TableViewSnapshot>({ storage: memoryStorage(seed) })
    expect(views).toHaveLength(2)
    expect(views[0]!.snapshot).not.toHaveProperty('multiSort')
    expect(views[1]!.snapshot).toHaveProperty('pageSize', 50)
  })

  it('returns an empty list for corrupt or hostile storage', () => {
    expect(readTableViews({ storage: memoryStorage('not json') })).toEqual([])
    expect(readTableViews({ storage: memoryStorage('{"a":1}') })).toEqual([])
    expect(readTableViews({ storage: memoryStorage('[1,"x",null]') })).toEqual([])
    expect(
      readTableViews({ storage: memoryStorage(JSON.stringify([{ name: ' ', snapshot: {} }])) }),
    ).toEqual([])
    expect(
      readTableViews({
        storage: memoryStorage(JSON.stringify([{ name: TABLE_VIEWS_SAVE_ITEM, snapshot: {} }])),
      }),
    ).toEqual([])
    expect(
      readTableViews({
        storage: memoryStorage(JSON.stringify([{ name: 'Ok', snapshot: 'nope' }])),
      }),
    ).toEqual([])
  })

  it('is fail-inert when storage read/write throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(readTableViews({ storage: throwing })).toEqual([])
    expect(() =>
      writeTableViews({ storage: throwing }, [{ name: 'V', snapshot: { sort: null } }]),
    ).not.toThrow()
  })

  it('honors an explicit null fallback without touching ambient storage', () => {
    const ambient = {
      getItem: vi.fn(() => JSON.stringify([{ name: 'ambient', snapshot: {} }])),
      setItem: vi.fn(),
    }
    vi.stubGlobal('localStorage', ambient)
    const config = {}

    expect(readTableViews(config, null)).toEqual([])
    writeTableViews(config, [{ name: 'V', snapshot: {} }], null)
    expect(ambient.getItem).not.toHaveBeenCalled()
    expect(ambient.setItem).not.toHaveBeenCalled()
  })

  it('treats storage:false and missing config as no-ops', () => {
    const storage = memoryStorage(JSON.stringify([{ name: 'V', snapshot: { sort: null } }]))
    const setItem = vi.spyOn(storage, 'setItem')
    expect(readTableViews({ storage: false })).toEqual([])
    writeTableViews({ storage: false }, [{ name: 'V', snapshot: { sort: null } }])
    expect(setItem).not.toHaveBeenCalled()
    expect(readTableViews(undefined)).toEqual([])
    writeTableViews(undefined, [])
    expect(setItem).not.toHaveBeenCalled()
  })
})

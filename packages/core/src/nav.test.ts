import { describe, expect, it } from 'vitest'
import {
  isBranch,
  visibleNav,
  flattenNav,
  findNavNode,
  findNavPath,
  firstLeaf,
  type NavNode,
} from './nav'

const tree: NavNode[] = [
  { key: 'dash', title: 'Dashboard', order: 1 },
  {
    key: 'sys',
    title: 'System',
    order: 2,
    children: [
      { key: 'users', title: 'Users' },
      { key: 'roles', title: 'Roles', hidden: true },
      {
        key: 'settings',
        title: 'Settings',
        children: [{ key: 'profile', title: 'Profile' }],
      },
    ],
  },
  { key: 'hidden-root', title: 'Hidden', hidden: true },
]

describe('nav selectors', () => {
  it('isBranch reflects presence of children', () => {
    expect(isBranch(tree[1]!)).toBe(true)
    expect(isBranch(tree[0]!)).toBe(false)
    expect(isBranch({ key: 'x', title: 'X', children: [] })).toBe(false)
  })

  it('visibleNav drops hidden nodes and sorts by order, recursively', () => {
    const v = visibleNav([
      { key: 'b', title: 'B', order: 2 },
      { key: 'a', title: 'A', order: 1 },
      { key: 'h', title: 'H', hidden: true },
    ])
    expect(v.map((n) => n.key)).toEqual(['a', 'b'])

    const sys = visibleNav(tree).find((n) => n.key === 'sys')!
    expect(sys.children!.map((n) => n.key)).toEqual(['users', 'settings']) // roles hidden
  })

  it('visibleNav keeps a stable order for equal/absent orders', () => {
    const v = visibleNav([
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ])
    expect(v.map((n) => n.key)).toEqual(['a', 'b', 'c'])
  })

  it('flattenNav walks depth-first, parents before children', () => {
    expect(flattenNav(tree).map((n) => n.key)).toEqual([
      'dash',
      'sys',
      'users',
      'roles',
      'settings',
      'profile',
      'hidden-root',
    ])
  })

  it('findNavNode locates by key at any depth', () => {
    expect(findNavNode(tree, 'profile')?.title).toBe('Profile')
    expect(findNavNode(tree, 'nope')).toBeUndefined()
  })

  it('findNavPath returns the root→node ancestor chain', () => {
    expect(findNavPath(tree, 'profile').map((n) => n.key)).toEqual(['sys', 'settings', 'profile'])
    expect(findNavPath(tree, 'dash').map((n) => n.key)).toEqual(['dash'])
    expect(findNavPath(tree, 'missing')).toEqual([])
  })

  it('firstLeaf descends to the first leaf, or returns a leaf node as-is', () => {
    expect(firstLeaf(tree[1]!).key).toBe('users')
    expect(firstLeaf(tree[0]!).key).toBe('dash')
  })
})

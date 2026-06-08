import { describe, it, expect } from 'vitest'
import { branchTrail, filterNavByAccess, type NavNode } from './nav'

const tree: NavNode[] = [
  { key: 'dash', title: 'Dashboard' },
  {
    key: 'sys',
    title: 'System',
    children: [
      { key: 'users', title: 'Users' },
      { key: 'roles', title: 'Roles' },
    ],
  },
]

describe('branchTrail', () => {
  it('returns the branch-ancestor keys of a node (excluding itself)', () => {
    expect(branchTrail(tree, 'users')).toEqual(['sys'])
    expect(branchTrail(tree, 'dash')).toEqual([])
    expect(branchTrail(tree, 'sys')).toEqual([])
  })
})

describe('filterNavByAccess', () => {
  it('drops nodes failing the predicate', () => {
    const out = filterNavByAccess(tree, (n) => n.key !== 'users')
    const sys = out.find((n) => n.key === 'sys')
    expect(sys?.children?.map((c) => c.key)).toEqual(['roles'])
  })

  it('prunes a branch whose children are all dropped (default)', () => {
    const out = filterNavByAccess(tree, (n) => n.key !== 'users' && n.key !== 'roles')
    expect(out.map((n) => n.key)).toEqual(['dash'])
  })

  it('keeps empty branches when pruneEmptyBranches=false', () => {
    const out = filterNavByAccess(tree, (n) => n.key !== 'users' && n.key !== 'roles', false)
    expect(out.map((n) => n.key)).toEqual(['dash', 'sys'])
  })
})

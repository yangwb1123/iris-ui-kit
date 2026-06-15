import { describe, it, expect } from 'vitest'
import { branchTrail, filterNavByAccess, nodeAllowsRoles, type NavNode } from './nav'

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

const rbacTree: NavNode[] = [
  { key: 'dash', title: 'Dashboard' }, // no roles → everyone
  { key: 'users', title: 'Users', roles: ['admin', 'viewer'] },
  {
    key: 'admin',
    title: 'Admin',
    roles: ['admin'],
    children: [{ key: 'settings', title: 'Settings' }],
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

  it('roles-array form: gates each node by the user roles (RBAC)', () => {
    const admin = filterNavByAccess(rbacTree, ['admin'])
    expect(admin.map((n) => n.key)).toEqual(['dash', 'users', 'admin'])

    const viewer = filterNavByAccess(rbacTree, ['viewer'])
    // 'admin' (roles:['admin']) dropped; 'users' kept (viewer ∈ roles); dash open to all.
    expect(viewer.map((n) => n.key)).toEqual(['dash', 'users'])

    const guest = filterNavByAccess(rbacTree, [])
    // Only the role-free node survives.
    expect(guest.map((n) => n.key)).toEqual(['dash'])
  })
})

describe('nodeAllowsRoles', () => {
  it('a node with no roles is open to everyone (incl. empty user roles)', () => {
    expect(nodeAllowsRoles({ key: 'a', title: 'A' }, [])).toBe(true)
    expect(nodeAllowsRoles({ key: 'a', title: 'A', roles: [] }, [])).toBe(true)
  })

  it('a role-gated node needs at least one matching user role', () => {
    const node: NavNode = { key: 'a', title: 'A', roles: ['admin'] }
    expect(nodeAllowsRoles(node, ['admin'])).toBe(true)
    expect(nodeAllowsRoles(node, ['viewer'])).toBe(false)
    expect(nodeAllowsRoles(node, ['viewer', 'admin'])).toBe(true)
  })
})

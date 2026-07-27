import { describe, expect, it } from 'vitest'
import { filterNavByAccess, nodeAllowsRoles, type NavNode } from './index'

describe('@iris-ui-kit/svelte admin public RBAC helpers', () => {
  it('re-exports role gating from the admin and root barrels', () => {
    const nodes: NavNode[] = [
      { key: 'open', title: 'Open' },
      { key: 'admin', title: 'Admin', roles: ['admin'] },
    ]
    expect(nodeAllowsRoles(nodes[1]!, ['viewer'])).toBe(false)
    expect(filterNavByAccess(nodes, ['viewer']).map((node) => node.key)).toEqual(['open'])
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildNavTree,
  isBranch,
  visibleNav,
  flattenNav,
  findNavNode,
  findNavPath,
  firstLeaf,
  matchRoutePattern,
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

  describe('cycle protection', () => {
    it('handles a direct cyclic reference a→b→a', () => {
      const a: NavNode = { key: 'a', title: 'A', children: [] }
      const b: NavNode = { key: 'b', title: 'B', children: [a] }
      a.children = [b] // a → b → a — cycle
      const result = flattenNav([a])
      expect(result.map((n) => n.key)).toEqual(['a', 'b'])
    })

    it('handles a self-referencing node a→a', () => {
      const a: NavNode = { key: 'a', title: 'A', children: [] }
      a.children = [a] // a → a — self-cycle
      const result = flattenNav([a])
      expect(result.map((n) => n.key)).toEqual(['a'])
    })

    it('handles a deep chain without false positive (no cycle)', () => {
      const nodes: NavNode[] = [
        {
          key: '1',
          title: '1',
          children: [{ key: '2', title: '2', children: [{ key: '3', title: '3' }] }],
        },
      ]
      expect(flattenNav(nodes).map((n) => n.key)).toEqual(['1', '2', '3'])
    })

    it('handles shared children (same node ref in two parents) without double-counting', () => {
      const shared: NavNode = { key: 'shared', title: 'Shared' }
      const a: NavNode = { key: 'a', title: 'A', children: [shared] }
      const b: NavNode = { key: 'b', title: 'B', children: [shared] }
      const result = flattenNav([a, b])
      // shared appears under 'a', skipped when 'b' walks it
      expect(result.map((n) => n.key)).toEqual(['a', 'shared', 'b'])
    })

    it('handles empty children', () => {
      expect(flattenNav([])).toEqual([])
    })

    it('handles nodes with undefined children', () => {
      const n: NavNode = { key: 'n', title: 'N' }
      expect(flattenNav([n]).map((r) => r.key)).toEqual(['n'])
    })

    it('handles nodes with empty children array', () => {
      const n: NavNode = { key: 'n', title: 'N', children: [] }
      expect(flattenNav([n]).map((r) => r.key)).toEqual(['n'])
    })

    it('mixed normal + cyclic branch still produces all reachable unique nodes', () => {
      const a: NavNode = { key: 'a', title: 'A', children: [] }
      const b: NavNode = { key: 'b', title: 'B', children: [a] }
      a.children = [b]
      const c: NavNode = { key: 'c', title: 'C', children: [] }
      const result = flattenNav([a, c])
      // a, b, c all reachable; cycle a→b→a handled
      expect(result.map((n) => n.key)).toContain('a')
      expect(result.map((n) => n.key)).toContain('b')
      expect(result.map((n) => n.key)).toContain('c')
    })

    it('findNavNode works on a tree with cycles (does not hang)', () => {
      const a: NavNode = { key: 'a', title: 'A', children: [] }
      const b: NavNode = { key: 'b', title: 'B', children: [a] }
      a.children = [b]
      expect(findNavNode([a], 'a')?.title).toBe('A')
      expect(findNavNode([a], 'b')?.title).toBe('B')
      expect(findNavNode([a], 'missing')).toBeUndefined()
    })
  })

  describe('depth limit', () => {
    /**
     * Build a chain of `count` nodes: node_0 → node_1 → … → node_{count-1}
     * Using iterative construction to avoid stack overflow during test setup.
     */
    function chain(count: number): NavNode {
      const nodes: NavNode[] = []
      for (let i = 0; i < count; i++) {
        nodes.push({ key: 'node_' + i, title: 'Node ' + i, children: [] })
      }
      for (let i = 0; i < count - 1; i++) {
        nodes[i]!.children = [nodes[i + 1]!]
      }
      nodes[count - 1]!.children = []
      return nodes[0]!
    }

    it('truncates when chain depth exceeds MAX_DEPTH (1000)', () => {
      // A chain of 1002 nodes: depths 0..1000 are allowed (1001 nodes),
      // depth 1001 exceeds limit and is truncated.
      const root = chain(1002)
      const result = flattenNav([root])
      // Nodes at depth 0..1000 are processed (1001 nodes), node_1001 at
      // depth 1001 is truncated.
      expect(result).toHaveLength(1001)
      expect(result[0]!.key).toBe('node_0')
      expect(result[1000]!.key).toBe('node_1000')
      // node_1001 is never reached (depth 1001 > MAX_DEPTH 1000)
      expect(result.find((n) => n.key === 'node_1001')).toBeUndefined()
    })

    it('does not truncate at exactly MAX_DEPTH levels', () => {
      // A chain of 1001 nodes: depths 0..1000, all within limit.
      const root = chain(1001)
      const result = flattenNav([root])
      expect(result).toHaveLength(1001)
      expect(result[1000]!.key).toBe('node_1000')
    })

    it('does not truncate when depth is under limit', () => {
      const root = chain(500)
      const result = flattenNav([root])
      expect(result).toHaveLength(500)
      expect(result[499]!.key).toBe('node_499')
    })

    it('does not affect normal trees with moderate nesting', () => {
      const root = chain(10)
      const result = flattenNav([root])
      expect(result).toHaveLength(10)
    })
  })
})

describe('buildNavTree', () => {
  it('builds an ordered-depth tree from flat parent keys', () => {
    const result = buildNavTree([
      { key: 'root', title: 'Root' },
      { key: 'child', title: 'Child', parentKey: 'root' },
      { key: 'leaf', title: 'Leaf', parentKey: 'child' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.children?.[0]?.children?.[0]?.key).toBe('leaf')
  })

  it('promotes missing parents and breaks parent cycles', () => {
    const result = buildNavTree([
      { key: 'orphan', title: 'Orphan', parentKey: 'missing' },
      { key: 'a', title: 'A', parentKey: 'b' },
      { key: 'b', title: 'B', parentKey: 'a' },
    ])
    expect(
      flattenNav(result)
        .map((node) => node.key)
        .sort(),
    ).toEqual(['a', 'b', 'orphan'])
  })
})

describe('matchRoutePattern', () => {
  it('matches exact, dynamic and wildcard paths', () => {
    expect(matchRoutePattern('/orders/42', '/orders/:id')).toBe(true)
    expect(matchRoutePattern('/orders/42/items/7', '/orders/*')).toBe(true)
    expect(matchRoutePattern('/orders/42?tab=info', '/orders/:id/')).toBe(true)
  })

  it('rejects different segment counts and literals', () => {
    expect(matchRoutePattern('/orders', '/orders/:id')).toBe(false)
    expect(matchRoutePattern('/users/42', '/orders/:id')).toBe(false)
    expect(matchRoutePattern('/orders/42/items', '/orders/:id')).toBe(false)
  })
})

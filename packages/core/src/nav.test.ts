import { describe, expect, it } from 'vitest'
import {
  branchTrail,
  buildNavTree,
  filterNavByAccess,
  isBranch,
  nodeAllowsRoles,
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

  it('preserves leaf identity while projecting branches', () => {
    const leaf: NavNode = { key: 'leaf', title: 'Leaf' }
    const branch: NavNode = { key: 'branch', title: 'Branch', children: [leaf] }

    expect(visibleNav([leaf])[0]).toBe(leaf)
    expect(visibleNav([branch])[0]).not.toBe(branch)
    expect(filterNavByAccess([leaf], () => true)[0]).toBe(leaf)
    expect(filterNavByAccess([branch], () => true)[0]).not.toBe(branch)
    expect(firstLeaf(leaf)).toBe(leaf)
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

    it('cycle-protects every tree selector, not only flattenNav', () => {
      const a: NavNode = { key: 'a', title: 'A', children: [] }
      const b: NavNode = { key: 'b', title: 'B', children: [a] }
      a.children = [b]

      expect(() => visibleNav([a])).not.toThrow()
      expect(flattenNav(visibleNav([a])).map((n) => n.key)).toEqual(['a', 'b'])
      expect(findNavPath([a], 'missing')).toEqual([])
      expect(branchTrail([a], 'b')).toEqual(['a'])
      expect(firstLeaf(a).key).toBe('a')
      expect(flattenNav(filterNavByAccess([a], () => true, false)).map((n) => n.key)).toEqual([
        'a',
        'b',
      ])
    })

    it('ignores malformed entries and malformed child collections', () => {
      const valid: NavNode = { key: 'valid', title: 'Valid', children: {} as NavNode[] }
      const malformed = [null, 1, { title: 'missing key' }, valid] as unknown as NavNode[]

      expect(visibleNav(malformed).map((n) => n.key)).toEqual(['valid'])
      expect(flattenNav(malformed).map((n) => n.key)).toEqual(['valid'])
      expect(findNavPath(malformed, 'valid')).toEqual([valid])
      expect(filterNavByAccess(malformed, () => true)).toEqual([valid])
      expect(firstLeaf(valid)).toBe(valid)
    })

    it('handles a deeply nested tree without recursion limits', () => {
      const nodes: NavNode[] = []
      for (let i = 0; i < 12000; i += 1) {
        nodes.push({ key: `deep-${i}`, title: `Deep ${i}` })
        if (i > 0) nodes[i - 1]!.children = [nodes[i]!]
      }
      const root = nodes[0]!

      expect(flattenNav([root])).toHaveLength(nodes.length)
      expect(flattenNav(visibleNav([root]))).toHaveLength(nodes.length)
      expect(findNavPath([root], 'deep-11999')).toHaveLength(nodes.length)
      expect(flattenNav(filterNavByAccess([root], () => true)).length).toBe(nodes.length)
      expect(firstLeaf(root)).toBe(nodes[nodes.length - 1])
    })

    it('handles inherited fields and prototype-sensitive keys safely', () => {
      const inherited = Object.create({
        key: 'inherited',
        hidden: true,
        roles: ['admin'],
      }) as NavNode
      inherited.title = 'Inherited'
      const special = Object.create(null) as NavNode
      special.key = '__proto__'
      special.title = 'Special'
      const tree = [inherited, special]

      expect(flattenNav(tree)).toEqual([special])
      expect(visibleNav(tree)).toEqual([special])
      expect(nodeAllowsRoles(inherited, [])).toBe(true)
      expect(
        buildNavTree([
          { key: '__proto__', title: 'Proto' },
          { key: 'constructor', title: 'Constructor' },
          { key: '__proto__', title: 'Duplicate' },
        ]).map((n) => n.key),
      ).toEqual(['__proto__', 'constructor'])
    })

    it('keeps finite order ahead of non-finite orders deterministically', () => {
      const result = visibleNav([
        { key: 'nan', title: 'NaN', order: Number.NaN },
        { key: 'finite', title: 'Finite', order: 1 },
        { key: 'positive', title: 'Positive', order: Number.POSITIVE_INFINITY },
        { key: 'negative', title: 'Negative', order: Number.NEGATIVE_INFINITY },
        { key: 'missing', title: 'Missing' },
      ])
      expect(result.map((n) => n.key)).toEqual(['finite', 'nan', 'positive', 'negative', 'missing'])
    })

    it('supports an empty string as a real parent key', () => {
      const result = buildNavTree([
        { key: '', title: 'Empty' },
        { key: 'child', title: 'Child', parentKey: '' },
      ])
      expect(result).toHaveLength(1)
      expect(result[0]!.children?.map((n) => n.key)).toEqual(['child'])
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

  describe('deep nesting', () => {
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

    it('does not truncate a chain beyond the former depth limit', () => {
      // A chain of 1002 nodes remains fully traversable.
      const root = chain(1002)
      const result = flattenNav([root])
      // Iterative traversal keeps every valid node, regardless of depth.
      expect(result).toHaveLength(1002)
      expect(result[0]!.key).toBe('node_0')
      expect(result[1000]!.key).toBe('node_1000')
      expect(result[1001]!.key).toBe('node_1001')
    })

    it('handles a chain with 1001 nodes', () => {
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

  it('builds a deeply nested flat tree without quadratic parent walks', () => {
    const flat = Array.from({ length: 12000 }, (_, index) => ({
      key: `flat-${index}`,
      title: `Flat ${index}`,
      parentKey: index === 0 ? null : `flat-${index - 1}`,
    }))
    const result = buildNavTree(flat)
    expect(flattenNav(result)).toHaveLength(flat.length)
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

  it('fails closed for malformed non-string runtime inputs', () => {
    expect(matchRoutePattern(Number.NaN as unknown as string, '/orders')).toBe(false)
    expect(matchRoutePattern('/orders', Number.POSITIVE_INFINITY as unknown as string)).toBe(false)
  })
})

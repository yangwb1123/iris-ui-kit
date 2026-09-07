/**
 * Framework-agnostic navigation-tree model + pure selectors for admin layouts.
 *
 * One normalized `NavNode[]` tree drives the side/header menu, the breadcrumb
 * trail, and (via the host) the open-tabs set — mirroring how Vben derives every
 * nav region from a single route/menu config. These are pure functions: no
 * store, no framework, no router. The host maps its router → `NavNode[]` and
 * computes the active key; the selectors here turn that into menu/breadcrumb
 * shapes.
 */

export interface NavNode {
  /** Stable unique key (route name / path). */
  key: string
  /** Display label. */
  title: string
  /** Optional icon name, resolved by the host's icon registry. */
  icon?: string
  /** Optional path / href; routing is host-owned. */
  path?: string
  /** Optional badge text or count shown on the menu item. */
  badge?: string | number
  /** Disable interaction. */
  disabled?: boolean
  /** Hide from the rendered menu (kept in the tree for path/breadcrumb lookups). */
  hidden?: boolean
  /** Sort order among siblings (ascending; missing sorts last, stably). */
  order?: number
  /**
   * Roles allowed to see this node (RBAC). A node with no `roles` (undefined or
   * empty) is visible to everyone; otherwise it is shown only when the current
   * user holds at least one of the listed roles. Consumed by the
   * `roles`-array form of {@link filterNavByAccess}. A branch's own `roles`
   * gate the branch itself; children carry their own `roles`.
   */
  roles?: string[]
  /** Child nodes — the node is a branch (group / submenu) when this is non-empty. */
  children?: NavNode[]
}

/** Flat authoring shape accepted by {@link buildNavTree}. */
export interface FlatNavNode extends Omit<NavNode, 'children'> {
  /** Parent node key; `null`/undefined makes this a root node. */
  parentKey?: string | null
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function isNavNode(value: unknown): value is NavNode {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    hasOwn(value, 'key') &&
    typeof (value as { key?: unknown }).key === 'string'
  )
}

/** Treat malformed child collections as leaves and ignore malformed children. */
function childrenOf(node: NavNode): NavNode[] | undefined {
  if (!hasOwn(node, 'children') || !Array.isArray(node.children)) return undefined
  return node.children.filter(isNavNode)
}

/** A node is a branch (group / submenu) when it has at least one child. */
export function isBranch(node: NavNode): boolean {
  return childrenOf(node)?.length ? true : false
}

function orderOf(node: NavNode): number {
  const order = hasOwn(node, 'order') ? node.order : undefined
  return typeof order === 'number' && Number.isFinite(order) ? order : Number.POSITIVE_INFINITY
}

function byOrder(a: NavNode, b: NavNode): number {
  const left = orderOf(a)
  const right = orderOf(b)
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * A render-ready copy of the tree: `hidden` nodes dropped and each level sorted
 * by `order` (stable for equal/absent orders). Cyclic and malformed child
 * references are skipped without mutating the source tree.
 */
export function visibleNav(nodes: NavNode[]): NavNode[] {
  interface Frame {
    list: NavNode[]
    index: number
    output: NavNode[]
    parent?: { node: NavNode; output: NavNode[]; key: string }
  }

  const root: Frame = { list: Array.isArray(nodes) ? nodes : [], index: 0, output: [] }
  const stack: Frame[] = [root]
  const active = new Set<string>()

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!
    if (frame.index < frame.list.length) {
      const node = frame.list[frame.index++]
      if (!isNavNode(node) || (hasOwn(node, 'hidden') && node.hidden) || active.has(node.key)) {
        continue
      }

      if (hasOwn(node, 'children') && Array.isArray(node.children)) {
        active.add(node.key)
        stack.push({
          list: childrenOf(node) ?? [],
          index: 0,
          output: [],
          parent: { node, output: frame.output, key: node.key },
        })
      } else {
        frame.output.push(node)
      }
      continue
    }

    stack.pop()
    frame.output.sort(byOrder)
    if (frame.parent) {
      active.delete(frame.parent.key)
      frame.parent.output.push({ ...frame.parent.node, children: frame.output })
    } else {
      return frame.output
    }
  }

  return []
}

/**
 * Depth-first flatten of every node (parents before their children).
 *
 * Safe against cyclic references: tracks visited nodes via a `Set<string>` and
 * skips repeated keys (dev-mode console.warn). Traversal is iterative so deeply
 * nested trees do not overflow the call stack.
 *
 * This mirrors the same cycle protection in {@link flattenTree} (data-view/tree.ts).
 */
export function flattenNav(nodes: NavNode[]): NavNode[] {
  const out: NavNode[] = []
  const seen = new Set<string>()
  const stack: Array<{ list: NavNode[]; index: number }> = [
    { list: Array.isArray(nodes) ? nodes : [], index: 0 },
  ]

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!
    if (frame.index >= frame.list.length) {
      stack.pop()
      continue
    }

    const node = frame.list[frame.index++]
    if (!isNavNode(node)) continue
    if (seen.has(node.key)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[iris-ui] flattenNav: cycle detected at node "' +
            node.key +
            '" — ' +
            'skipping already-visited node. Check your NavNode children for circular references.',
        )
      }
      continue
    }
    seen.add(node.key)
    out.push(node)
    const children = childrenOf(node)
    if (children && children.length > 0) stack.push({ list: children, index: 0 })
  }

  return out
}

/** Find a node by key (depth-first), or `undefined`. */
export function findNavNode(nodes: NavNode[], key: string): NavNode | undefined {
  return flattenNav(nodes).find((n) => n.key === key)
}

/**
 * The ancestor→node chain for `key` (root first, the node itself last), or `[]`
 * when not found. Feeds the breadcrumb trail and the set of expanded menu keys.
 */
export function findNavPath(nodes: NavNode[], key: string): NavNode[] {
  const path: NavNode[] = []
  const active = new Set<string>()
  const stack: Array<{ list: NavNode[]; index: number; key?: string }> = [
    { list: Array.isArray(nodes) ? nodes : [], index: 0 },
  ]

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!
    if (frame.index >= frame.list.length) {
      stack.pop()
      if (frame.key !== undefined) {
        active.delete(frame.key)
        path.pop()
      }
      continue
    }

    const node = frame.list[frame.index++]
    if (!isNavNode(node) || active.has(node.key)) continue
    path.push(node)
    if (node.key === key) return path

    const children = childrenOf(node)
    if (children && children.length > 0) {
      active.add(node.key)
      stack.push({ list: children, index: 0, key: node.key })
    } else {
      path.pop()
    }
  }

  return []
}

/**
 * The first leaf reachable from `node` (depth-first), or `node` itself when it
 * is already a leaf. Used to redirect a branch click to its first real page.
 */
export function firstLeaf(node: NavNode): NavNode {
  let current = node
  const seen = new Set<string>()
  while (isNavNode(current)) {
    if (seen.has(current.key)) return current
    seen.add(current.key)
    const children = childrenOf(current)
    if (!children || children.length === 0) return current
    current = children[0]!
  }
  return node
}

/**
 * The keys of the **branch ancestors** of `key` (excluding the node itself) —
 * i.e. the menu groups that must be expanded for `key` to be visible. The
 * canonical "auto-open the active trail" set, previously re-derived in every
 * adapter's NavMenu.
 */
export function branchTrail(nodes: NavNode[], key: string): string[] {
  return findNavPath(nodes, key)
    .slice(0, -1)
    .filter(isBranch)
    .map((n) => n.key)
}

/**
 * Whether `node` is reachable by a user holding `userRoles`, per the node's
 * `roles` (RBAC): a node with no `roles` (undefined or empty) is open to all;
 * otherwise the user must hold at least one of the node's listed roles. The
 * default access rule used by the `roles`-array form of {@link filterNavByAccess}.
 */
export function nodeAllowsRoles(node: NavNode, userRoles: readonly string[]): boolean {
  if (!hasOwn(node, 'roles') || node.roles === undefined) return true
  if (!Array.isArray(node.roles)) return false
  if (node.roles.length === 0) return true
  if (!Array.isArray(userRoles)) return false
  return node.roles.some((role) => typeof role === 'string' && userRoles.includes(role))
}

/**
 * Filter the tree by access — the pure complement to {@link visibleNav}'s static
 * `hidden` filter. Pass either:
 *
 * - a **predicate** `(node) => boolean`: a node is dropped when it returns false
 *   (the original ACL form — full permission/condition control); or
 * - a **roles array** `string[]` (the current user's roles): each node is gated
 *   by {@link nodeAllowsRoles} — kept when it has no `roles`, or when the user
 *   holds one of the node's `roles`.
 *
 * By default a branch whose children are all dropped is pruned too (pass
 * `pruneEmptyBranches: false` to keep empty groups). Back-compatible: existing
 * predicate callers are unchanged.
 */
export function filterNavByAccess(
  nodes: NavNode[],
  access: ((node: NavNode) => boolean) | readonly string[],
  pruneEmptyBranches = true,
): NavNode[] {
  const can: (node: NavNode) => boolean = Array.isArray(access)
    ? (node) => nodeAllowsRoles(node, access)
    : typeof access === 'function'
      ? access
      : () => false
  interface Frame {
    list: NavNode[]
    index: number
    output: NavNode[]
    parent?: { node: NavNode; output: NavNode[]; key: string }
  }

  const root: Frame = { list: Array.isArray(nodes) ? nodes : [], index: 0, output: [] }
  const stack: Frame[] = [root]
  const active = new Set<string>()

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!
    if (frame.index < frame.list.length) {
      const node = frame.list[frame.index++]
      if (!isNavNode(node) || active.has(node.key) || !can(node)) continue

      const children = childrenOf(node)
      if (children && children.length > 0) {
        active.add(node.key)
        stack.push({
          list: children,
          index: 0,
          output: [],
          parent: { node, output: frame.output, key: node.key },
        })
      } else {
        frame.output.push(node)
      }
      continue
    }

    stack.pop()
    if (frame.parent) {
      active.delete(frame.parent.key)
      if (frame.output.length > 0 || !pruneEmptyBranches) {
        frame.parent.output.push({ ...frame.parent.node, children: frame.output })
      }
    } else {
      return frame.output
    }
  }

  return []
}

/**
 * Build a normalized `NavNode[]` tree from a flat route/menu list.
 *
 * Unknown parents are promoted to roots so a partially loaded server menu
 * remains usable. Duplicate keys keep the first item. Parent cycles are broken
 * by promoting the cyclic node to a root.
 */
export function buildNavTree(flat: FlatNavNode[]): NavNode[] {
  const nodes = new Map<string, NavNode>()
  const parents = new Map<string, string | null>()
  for (const item of Array.isArray(flat) ? flat : []) {
    if (!isNavNode(item) || nodes.has(item.key)) continue
    const parentKey =
      hasOwn(item, 'parentKey') && typeof item.parentKey === 'string' ? item.parentKey : null
    const { parentKey: _parentKey, ...node } = item
    nodes.set(item.key, { ...node })
    parents.set(item.key, parentKey)
  }

  const cycleKeys = new Set<string>()
  const state = new Map<string, 'visiting' | 'done'>()
  for (const start of nodes.keys()) {
    if (state.get(start) === 'done') continue
    const path: string[] = []
    const positions = new Map<string, number>()
    let cursor: string | null | undefined = start
    while (cursor !== null && cursor !== undefined && nodes.has(cursor)) {
      const position = positions.get(cursor)
      if (position !== undefined) {
        for (let i = position; i < path.length; i += 1) cycleKeys.add(path[i]!)
        break
      }
      if (state.get(cursor) === 'done') break
      positions.set(cursor, path.length)
      state.set(cursor, 'visiting')
      path.push(cursor)
      cursor = parents.get(cursor)
    }
    for (const key of path) state.set(key, 'done')
  }

  const roots: NavNode[] = []
  for (const [key, node] of nodes) {
    const parentKey = parents.get(key)
    const parent = parentKey !== null && parentKey !== undefined ? nodes.get(parentKey) : undefined
    if (!parent || (parentKey !== null && parentKey !== undefined && cycleKeys.has(key))) {
      roots.push(node)
      continue
    }
    parent.children = [...(parent.children ?? []), node]
  }
  return roots
}

const routeSegments = (value: string): string[] => {
  const path = value.split(/[?#]/, 1)[0] ?? ''
  return path.split('/').filter(Boolean)
}

/**
 * Match a concrete path against a route pattern.
 *
 * `:segment` matches exactly one path segment and `*` consumes the remainder.
 * Query/hash fragments and trailing slashes do not affect matching.
 */
export function matchRoutePattern(path: string, pattern: string): boolean {
  if (typeof path !== 'string' || typeof pattern !== 'string') return false
  const actual = routeSegments(path)
  const expected = routeSegments(pattern)
  let i = 0
  for (; i < expected.length; i += 1) {
    const segment = expected[i]
    if (segment === '*') return true
    if (actual[i] === undefined) return false
    if (!segment?.startsWith(':') && segment !== actual[i]) return false
  }
  return i === actual.length
}

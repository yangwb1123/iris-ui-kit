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

/** A node is a branch (group / submenu) when it has at least one child. */
export function isBranch(node: NavNode): boolean {
  return Array.isArray(node.children) && node.children.length > 0
}

function byOrder(a: NavNode, b: NavNode): number {
  return (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY)
}

/**
 * A render-ready copy of the tree: `hidden` nodes dropped and each level sorted
 * by `order` (stable for equal/absent orders). Recurses into children.
 */
export function visibleNav(nodes: NavNode[]): NavNode[] {
  return nodes
    .filter((n) => !n.hidden)
    .map((n) => (n.children ? { ...n, children: visibleNav(n.children) } : n))
    .sort(byOrder)
}

/** Depth-first flatten of every node (parents before their children). */
export function flattenNav(nodes: NavNode[]): NavNode[] {
  const out: NavNode[] = []
  const walk = (list: NavNode[]): void => {
    for (const n of list) {
      out.push(n)
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
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
  const walk = (list: NavNode[]): boolean => {
    for (const n of list) {
      path.push(n)
      if (n.key === key) return true
      if (n.children && walk(n.children)) return true
      path.pop()
    }
    return false
  }
  walk(nodes)
  return path
}

/**
 * The first leaf reachable from `node` (depth-first), or `node` itself when it
 * is already a leaf. Used to redirect a branch click to its first real page.
 */
export function firstLeaf(node: NavNode): NavNode {
  let current = node
  while (current.children && current.children.length > 0) current = current.children[0]!
  return current
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
  if (!node.roles || node.roles.length === 0) return true
  return node.roles.some((r) => userRoles.includes(r))
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
    : (access as (node: NavNode) => boolean)
  const out: NavNode[] = []
  for (const n of nodes) {
    if (!can(n)) continue
    if (n.children && n.children.length > 0) {
      const children = filterNavByAccess(n.children, can, pruneEmptyBranches)
      if (children.length === 0 && pruneEmptyBranches) continue
      out.push({ ...n, children })
    } else {
      out.push(n)
    }
  }
  return out
}

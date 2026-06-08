import { createSelectionModel, type SelectionModel, type SelectionKey } from './selection'

/**
 * Framework-agnostic tree-selection controller — parent→child cascade plus the
 * indeterminate (half-checked) tri-state, the notoriously bug-prone core of any
 * checkable Tree / TreeSelect / Transfer-tree / permission picker (each
 * framework re-derives it today). Built on {@link createSelectionModel} (its
 * Set-backed membership keeps `isChecked` O(1)); this layer adds the hierarchy:
 * checking a node checks all descendants and recomputes every ancestor
 * (all-children-checked → checked, some → indeterminate, none → unchecked).
 *
 * The tree is described by a flat node list with `parentKey` (a missing/unknown
 * parent makes a node a root), so it is layout-agnostic and matches how the nav
 * tree is already flattened. Disabled nodes are skipped by the cascade.
 */
export interface TreeSelectionNode<K extends SelectionKey = string> {
  key: K
  /** Parent key, or `undefined`/unknown for a root node. */
  parentKey?: K
  /** Excluded from cascade (its own state is left untouched). */
  disabled?: boolean
}

export interface TreeSelectionConfig<K extends SelectionKey = string> {
  nodes: TreeSelectionNode<K>[]
  /** Initially checked keys (descendants/ancestors are reconciled on init). */
  defaultChecked?: K[]
  /** Notified with the fully-reconciled checked leaf+branch keys on every change. */
  onChange?: (keys: K[]) => void
}

export interface TreeSelectionModel<K extends SelectionKey = string> {
  /** Underlying selection model (checked keys); its store drives reactivity. */
  selection: SelectionModel<K>
  isChecked(key: K): boolean
  isIndeterminate(key: K): boolean
  /** Toggle a node, cascading to descendants and recomputing ancestors. */
  toggle(key: K): void
  check(key: K): void
  uncheck(key: K): void
  /** All currently-checked keys (branches included). */
  getChecked(): K[]
  /** Only the checked leaf keys (no children) — the usual form-submit value. */
  getCheckedLeaves(): K[]
}

export function createTreeSelection<K extends SelectionKey = string>(
  config: TreeSelectionConfig<K>,
): TreeSelectionModel<K> {
  const { nodes } = config

  // Adjacency built once: children per key, and the node record per key.
  const childrenOf = new Map<K, K[]>()
  const nodeOf = new Map<K, TreeSelectionNode<K>>()
  for (const node of nodes) {
    nodeOf.set(node.key, node)
    if (!childrenOf.has(node.key)) childrenOf.set(node.key, [])
  }
  for (const node of nodes) {
    if (node.parentKey !== undefined && nodeOf.has(node.parentKey)) {
      const siblings = childrenOf.get(node.parentKey)
      if (siblings) siblings.push(node.key)
    }
  }

  const isLeaf = (key: K): boolean => (childrenOf.get(key)?.length ?? 0) === 0
  const isDisabled = (key: K): boolean => nodeOf.get(key)?.disabled === true

  /** Depth-first descendants of `key` (excluding `key`), cycle-guarded. */
  function descendants(key: K, visited = new Set<K>()): K[] {
    const out: K[] = []
    for (const child of childrenOf.get(key) ?? []) {
      if (visited.has(child)) continue
      visited.add(child)
      out.push(child, ...descendants(child, visited))
    }
    return out
  }

  // Checked-leaf set is the source of truth; branch checked/indeterminate are
  // DERIVED from their leaves, so the tree can never hold an inconsistent state.
  const selection = createSelectionModel<K>({ mode: 'multiple' })

  // A branch's checked/indeterminate state is derived from its NON-disabled
  // leaves only, consistent with the cascade (which also skips disabled leaves)
  // so a disabled leaf can never block its parent from reaching `checked`.
  const enabledLeavesUnder = (key: K): K[] =>
    descendants(key).filter((k) => isLeaf(k) && !isDisabled(k))

  const isChecked = (key: K): boolean => {
    if (isLeaf(key)) return selection.isSelected(key)
    const leaves = enabledLeavesUnder(key)
    return leaves.length > 0 && leaves.every((k) => selection.isSelected(k))
  }
  const isIndeterminate = (key: K): boolean => {
    if (isLeaf(key)) return false
    const leaves = enabledLeavesUnder(key)
    const checked = leaves.filter((k) => selection.isSelected(k)).length
    return checked > 0 && checked < leaves.length
  }

  /** Leaves under `key` (or `key` itself if it is a leaf), skipping disabled. */
  function affectedLeaves(key: K): K[] {
    if (isDisabled(key)) return []
    if (isLeaf(key)) return [key]
    return enabledLeavesUnder(key)
  }

  function setChecked(key: K, checked: boolean): void {
    const leaves = affectedLeaves(key)
    if (leaves.length === 0) return
    const next = new Set<K>(selection.get())
    for (const leaf of leaves) {
      if (checked) next.add(leaf)
      else next.delete(leaf)
    }
    selection.set([...next])
  }

  const api: TreeSelectionModel<K> = {
    selection,
    isChecked,
    isIndeterminate,
    toggle(key) {
      // Toggle relative to the node's current resolved checked state.
      setChecked(key, !isChecked(key))
      config.onChange?.(api.getChecked())
    },
    check(key) {
      setChecked(key, true)
      config.onChange?.(api.getChecked())
    },
    uncheck(key) {
      setChecked(key, false)
      config.onChange?.(api.getChecked())
    },
    getCheckedLeaves: () => selection.get(),
    getChecked: () => {
      // Checked leaves plus any branch whose leaves are all checked.
      const result = new Set<K>(selection.get())
      for (const node of nodes) {
        if (!isLeaf(node.key) && isChecked(node.key)) result.add(node.key)
      }
      return [...result]
    },
  }

  // Reconcile the initial selection through the cascade so seeds are consistent.
  if (config.defaultChecked && config.defaultChecked.length > 0) {
    for (const key of config.defaultChecked) setChecked(key, true)
  }

  return api
}

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

interface TreeSelectionIndex<K extends SelectionKey> {
  childrenOf: Map<K, K[]>
  nodeOf: Map<K, TreeSelectionNode<K>>
  isLeaf(key: K): boolean
  isDisabled(key: K): boolean
  enabledLeavesUnder(key: K): K[]
  affectedLeaves(key: K): K[]
}

function createTreeSelectionIndex<K extends SelectionKey>(
  nodes: TreeSelectionNode<K>[],
): TreeSelectionIndex<K> {
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

  const enabledLeavesUnder = (key: K): K[] =>
    descendants(key).filter((candidate) => isLeaf(candidate) && !isDisabled(candidate))
  const affectedLeaves = (key: K): K[] => {
    if (isDisabled(key)) return []
    if (isLeaf(key)) return [key]
    return enabledLeavesUnder(key)
  }

  return { childrenOf, nodeOf, isLeaf, isDisabled, enabledLeavesUnder, affectedLeaves }
}

function createTreeSelectionState<K extends SelectionKey>(
  index: TreeSelectionIndex<K>,
  selection: SelectionModel<K>,
): {
  isChecked(key: K): boolean
  isIndeterminate(key: K): boolean
  setChecked(key: K, checked: boolean): void
} {
  const isChecked = (key: K): boolean => {
    if (index.isLeaf(key)) return selection.isSelected(key)
    const leaves = index.enabledLeavesUnder(key)
    return leaves.length > 0 && leaves.every((leaf) => selection.isSelected(leaf))
  }
  const isIndeterminate = (key: K): boolean => {
    if (index.isLeaf(key)) return false
    const leaves = index.enabledLeavesUnder(key)
    const checked = leaves.filter((leaf) => selection.isSelected(leaf)).length
    return checked > 0 && checked < leaves.length
  }
  const setChecked = (key: K, checked: boolean): void => {
    const leaves = index.affectedLeaves(key)
    if (leaves.length === 0) return
    const next = new Set<K>(selection.get())
    for (const leaf of leaves) {
      if (checked) next.add(leaf)
      else next.delete(leaf)
    }
    selection.set([...next])
  }
  return { isChecked, isIndeterminate, setChecked }
}

function createTreeSelectionApi<K extends SelectionKey>(
  nodes: TreeSelectionNode<K>[],
  index: TreeSelectionIndex<K>,
  selection: SelectionModel<K>,
  onChange: ((keys: K[]) => void) | undefined,
): TreeSelectionModel<K> {
  const state = createTreeSelectionState(index, selection)
  const notify = (): void => onChange?.(api.getChecked())
  const api: TreeSelectionModel<K> = {
    selection,
    isChecked: state.isChecked,
    isIndeterminate: state.isIndeterminate,
    toggle(key) {
      state.setChecked(key, !state.isChecked(key))
      notify()
    },
    check(key) {
      state.setChecked(key, true)
      notify()
    },
    uncheck(key) {
      state.setChecked(key, false)
      notify()
    },
    getCheckedLeaves: () => selection.get(),
    getChecked: () => {
      const result = new Set<K>(selection.get())
      for (const node of nodes) {
        if (!index.isLeaf(node.key) && state.isChecked(node.key)) result.add(node.key)
      }
      return [...result]
    },
  }
  return api
}

export function createTreeSelection<K extends SelectionKey = string>(
  config: TreeSelectionConfig<K>,
): TreeSelectionModel<K> {
  const { nodes } = config

  // Checked-leaf set is the source of truth; branch checked/indeterminate are
  // DERIVED from their leaves, so the tree can never hold an inconsistent state.
  const selection = createSelectionModel<K>({ mode: 'multiple' })
  const index = createTreeSelectionIndex(nodes)
  const api = createTreeSelectionApi(nodes, index, selection, config.onChange)

  // Reconcile the initial selection through the cascade so seeds are consistent.
  if (config.defaultChecked && config.defaultChecked.length > 0) {
    const state = createTreeSelectionState(index, selection)
    for (const key of config.defaultChecked) state.setChecked(key, true)
  }

  return api
}

import { bench, describe } from 'vitest'
import { createExpansion } from './expansion'
import { flattenTree } from './data-view'
import { createFormStore } from './form'

/**
 * Component-scale throughput benches — the Tree and Form counterparts to
 * scale.bench.ts's data-source/virtualizer/selection coverage. Same rules:
 * NOT part of the test gate (absolute ms is runner-variant; read as a relative
 * baseline and watch for order-of-magnitude regressions, not percent noise).
 *
 * What each bench guards:
 * - tree flatten: that rendering a tree table is O(visible rows), not
 *   O(total nodes) — collapsed subtrees must not be walked.
 * - tree expand/collapse: that toggling one node's expansion is cheap
 *   regardless of how many OTHER nodes are already expanded.
 * - form @500 fields: that per-field validation state (dirty/touched/errors)
 *   scales linearly with field count, not quadratically — the failure mode a
 *   naive "re-derive everything on every keystroke" implementation hits.
 */

interface Node {
  id: string
  children?: Node[]
}

/** A balanced tree with `depth` levels and `branching` children per node. */
function makeTree(depth: number, branching: number): Node[] {
  let nextId = 0
  const build = (level: number): Node[] => {
    if (level === 0) return []
    const nodes: Node[] = []
    for (let i = 0; i < branching; i++) {
      nodes.push({ id: `n${nextId++}`, children: build(level - 1) })
    }
    return nodes
  }
  return build(depth)
}

// depth=6, branching=4 → 4+16+64+256+1024+4096 ≈ 5.5k nodes, matching the
// "Tree at 5k nodes" scale a large tree-table view realistically hits.
const bigTree = makeTree(6, 4)

function countNodes(nodes: readonly Node[]): number {
  let n = 0
  for (const node of nodes) {
    n += 1
    if (node.children) n += countNodes(node.children)
  }
  return n
}
const totalNodeCount = countNodes(bigTree)

describe(`tree flatten @${totalNodeCount} nodes`, () => {
  bench('all-collapsed (only roots visible)', () => {
    const expansion = createExpansion<string>({ mode: 'multiple' })
    flattenTree(bigTree, {
      getKey: (n) => n.id,
      getChildren: (n) => n.children,
      isExpanded: (key) => expansion.isExpanded(key),
    })
  })

  bench('fully expanded (every node visible)', () => {
    const expansion = createExpansion<string>({ mode: 'multiple' })
    const allIds: string[] = []
    const collect = (nodes: readonly Node[]): void => {
      for (const n of nodes) {
        allIds.push(n.id)
        if (n.children) collect(n.children)
      }
    }
    collect(bigTree)
    expansion.expandAll(allIds)
    flattenTree(bigTree, {
      getKey: (n) => n.id,
      getChildren: (n) => n.children,
      isExpanded: (key) => expansion.isExpanded(key),
    })
  })

  bench('one root expanded, rest collapsed (typical drill-down)', () => {
    const expansion = createExpansion<string>({ mode: 'multiple' })
    expansion.expand(bigTree[0]!.id)
    flattenTree(bigTree, {
      getKey: (n) => n.id,
      getChildren: (n) => n.children,
      isExpanded: (key) => expansion.isExpanded(key),
    })
  })
})

describe('tree expand/collapse toggle cost', () => {
  bench('toggle one node with many siblings already expanded', () => {
    const expansion = createExpansion<string>({ mode: 'multiple' })
    // Expand every root except the last — simulates a large "already open" tree.
    for (let i = 0; i < bigTree.length - 1; i++) expansion.expand(bigTree[i]!.id)
    expansion.toggle(bigTree[bigTree.length - 1]!.id)
  })
})

// 500 fields with a mix of validated and unvalidated — a realistic "large
// generated form" (a settings page, a schema-driven admin form) shape.
function makeFormShape(count: number): {
  initialValues: Record<string, string>
  validators: Record<string, (v: string) => string | undefined>
} {
  const initialValues: Record<string, string> = {}
  const validators: Record<string, (v: string) => string | undefined> = {}
  for (let i = 0; i < count; i++) {
    const key = `field${i}`
    initialValues[key] = ''
    if (i % 3 === 0) validators[key] = (v) => (v ? undefined : 'Required')
  }
  return { initialValues, validators }
}

describe('createFormStore @500 fields', () => {
  const { initialValues, validators } = makeFormShape(500)

  bench('construct', () => {
    createFormStore({ initialValues, validators })
  })

  bench('setFieldValue on every field (dirty-tracking under load)', () => {
    const form = createFormStore({ initialValues, validators })
    for (const key of Object.keys(initialValues)) {
      form.setFieldValue(key, `value-${key}`)
    }
  })

  bench('validateForm (166 validators, allSettled)', async () => {
    const form = createFormStore({ initialValues, validators })
    await form.validateForm()
  })

  bench('serialize after editing every field', () => {
    const form = createFormStore({ initialValues, validators })
    for (const key of Object.keys(initialValues)) {
      form.setFieldValue(key, `value-${key}`)
    }
    form.serialize()
  })
})

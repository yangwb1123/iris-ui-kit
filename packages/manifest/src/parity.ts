import type { Framework, IrisManifest, ManifestComponent } from './schema'
import { ALL_FRAMEWORKS } from './schema'

/**
 * Cross-framework parity accounting.
 *
 * ## Why this exists
 *
 * `stats.byFramework` and `source: 'native'` prove only that each adapter
 * *exports* a component and that its props were *extracted*. They say nothing
 * about whether the four adapters expose the same surface. A component can be
 * `native` in all four frameworks and still be four different components —
 * which is exactly what `IrisTable` is today (react 208 props vs vue 65).
 *
 * For an AI-native consumption layer that failure mode is silent: an agent
 * reads the react contract, emits code, and the same code fails on the other
 * three. Nothing in CI notices.
 *
 * ## What this metric is NOT
 *
 * This is a **visibility metric, not a quality score**. Per-framework contracts
 * are deliberately idiomatic — Vue's `modelValue` / `update:modelValue`,
 * Solid's `onChange`, and Svelte's callback props are intentionally *not*
 * normalised to React naming. So a low name-intersection can mean "differently
 * named" rather than "missing capability".
 *
 * That is why the summary reports two independent signals:
 *
 * - **nameIntersection** — how many prop names are shared by all frameworks.
 *   Sensitive to idiom; a *lower bound* on true capability overlap.
 * - **surfaceAsymmetry** — the ratio of the largest to smallest per-framework
 *   prop count. Idiomatic naming cannot explain a 3x gap, so a high asymmetry
 *   is strong evidence of genuinely missing capability.
 *
 * Both are reported per component and in aggregate. The aggregate is ratcheted
 * by `scripts/check-parity.mjs`, which fails only when parity *degrades*.
 */

/** Fraction of shared prop names at or above which a component counts as near-identical. */
export const NEAR_IDENTICAL_THRESHOLD = 0.8

/** How many worst-offending components to list in the manifest summary. */
const WORST_OFFENDER_LIMIT = 12

export interface ComponentParity {
  name: string
  /** Prop names present in every framework. */
  common: string[]
  /** Distinct prop names across all frameworks. */
  union: string[]
  /** `common.length / union.length`, 1 when the union is empty. */
  ratio: number
  /** Per-framework prop count, for every framework in canonical order. */
  byFramework: Record<Framework, number>
  /**
   * Prop names no other framework declares. The key `shared` lists names
   * present in at least two frameworks but not all.
   */
  uniqueTo: Partial<Record<Framework, string[]>>
  /** Prop names declared by some, but not all, frameworks. */
  shared: string[]
  /**
   * Frameworks whose props are a bare intrinsic attribute spread
   * (`propsSource: 'intrinsic-spread'`), e.g. `React.HTMLAttributes<…>`. Their
   * real surface is the whole attribute set, so comparing their (empty) prop
   * list against a framework's declared props measures an *extraction* gap, not
   * a capability gap. Non-empty means this row is excluded from the buckets.
   */
  intrinsic: Framework[]
  /**
   * `largest byFramework count / smallest byFramework count`, rounded to 2dp.
   * `1` when the spread is 0. A high value indicates missing capability
   * rather than naming idiom.
   */
  asymmetry: number
}

export interface ParitySummary {
  /**
   * How to read these numbers. Kept in the artifact so an AI consumer does not
   * mistake the metric for a pass/fail parity guarantee.
   */
  caveat: string
  /**
   * The `common / union` ratio at or above which a component counts as
   * near-identical. Emitted so downstream gates can re-bucket the contracts
   * without re-implementing this policy.
   */
  threshold: number
  /** Components whose prop sets are byte-identical across every framework. */
  identical: number
  /** Components at or above `NEAR_IDENTICAL_THRESHOLD`. */
  nearIdentical: number
  /** Components below `NEAR_IDENTICAL_THRESHOLD`. */
  divergent: number
  /** Components that could not be compared (missing a per-framework contract). */
  incomparable: number
  /**
   * Components excluded from the buckets because at least one framework's props
   * are a bare intrinsic attribute spread, making a name-intersection
   * meaningless. Reported separately rather than counted as divergence.
   */
  intrinsicSpread: number
  /** Total prop declarations per framework across all components. */
  propTotals: Record<Framework, number>
  /**
   * Count of prop *names* declared by exactly one framework. These are the
   * capabilities that exist on one adapter and nowhere else.
   */
  exclusivePropNames: Record<Framework, number>
  /** Mean and minimum of the per-component name-intersection ratio. */
  meanRatio: number
  minRatio: number
  /** Components with the widest largest/smallest prop-count gap. */
  maxAsymmetry: { name: string; ratio: number; byFramework: Record<Framework, number> } | null
  /** The `WORST_OFFENDER_LIMIT` most divergent components, ascending by ratio. */
  worst: ComponentParity[]
}

function propNames(component: ManifestComponent, framework: Framework): string[] {
  return component.frameworkContracts?.[framework]?.props.map((prop) => prop.name) ?? []
}

/** Frameworks whose props are a bare intrinsic attribute spread. */
export function intrinsicFrameworks(component: ManifestComponent): Framework[] {
  return ALL_FRAMEWORKS.filter(
    (framework) => component.frameworkContracts?.[framework]?.propsSource === 'intrinsic-spread',
  )
}

/** Per-component parity: shared names, exclusive names, and surface asymmetry. */
export function computeComponentParity(component: ManifestComponent): ComponentParity {
  const byFramework = {} as Record<Framework, number>
  const perFramework = new Map<Framework, string[]>()
  const intrinsic = intrinsicFrameworks(component)
  for (const framework of ALL_FRAMEWORKS) {
    const names = propNames(component, framework)
    perFramework.set(framework, names)
    byFramework[framework] = names.length
  }

  // How many frameworks declare each prop name.
  const declarationCount = new Map<string, number>()
  for (const names of perFramework.values()) {
    for (const name of new Set(names)) {
      declarationCount.set(name, (declarationCount.get(name) ?? 0) + 1)
    }
  }

  const common: string[] = []
  const shared: string[] = []
  const uniqueTo: Partial<Record<Framework, string[]>> = {}
  for (const framework of ALL_FRAMEWORKS) uniqueTo[framework] = []

  for (const [name, count] of declarationCount) {
    if (count === ALL_FRAMEWORKS.length) {
      common.push(name)
      continue
    }
    if (count === 1) {
      for (const framework of ALL_FRAMEWORKS) {
        if (perFramework.get(framework)!.includes(name)) uniqueTo[framework]!.push(name)
      }
      continue
    }
    shared.push(name)
  }

  const sort = (list: string[]): string[] => [...list].sort()
  const commonSorted = sort(common)
  const union = sort([...declarationCount.keys()])
  const counts = ALL_FRAMEWORKS.map((framework) => byFramework[framework])
  const largest = Math.max(...counts, 0)
  const smallest = Math.min(...counts)
  const asymmetry = smallest === 0 ? (largest === 0 ? 1 : largest) : round2(largest / smallest)

  return {
    name: component.name,
    common: commonSorted,
    union,
    ratio: union.length === 0 ? 1 : round2(commonSorted.length / union.length),
    byFramework,
    uniqueTo: Object.fromEntries(
      ALL_FRAMEWORKS.map((framework) => [framework, sort(uniqueTo[framework]!)]),
    ) as Record<Framework, string[]>,
    shared: sort(shared),
    intrinsic,
    asymmetry,
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Components that cannot be compared because some framework has no contract. */
function isComparable(component: ManifestComponent): boolean {
  return ALL_FRAMEWORKS.every(
    (framework) => component.frameworkContracts?.[framework] !== undefined,
  )
}

/**
 * Aggregate cross-framework parity for a whole manifest.
 *
 * Deterministic: every list is sorted and the worst-offender list is broken by
 * name, so identical input always yields byte-identical output.
 */
export function computeParitySummary(components: ManifestComponent[]): ParitySummary {
  const comparable = components.filter(isComparable)
  const incomparable = components.length - comparable.length
  const rows = comparable.map(computeComponentParity).sort((a, b) => a.name.localeCompare(b.name))

  const propTotals = {} as Record<Framework, number>
  const exclusivePropNames = {} as Record<Framework, number>
  for (const framework of ALL_FRAMEWORKS) {
    propTotals[framework] = 0
    exclusivePropNames[framework] = 0
  }
  for (const row of rows) {
    for (const framework of ALL_FRAMEWORKS) {
      propTotals[framework] += row.byFramework[framework]
      exclusivePropNames[framework] += row.uniqueTo[framework]!.length
    }
  }

  // A framework that forwards the whole attribute set has nothing enumerable to
  // intersect, so its row is not evidence of divergence. Those rows are counted
  // separately and excluded from the buckets.
  const scored = rows.filter((row) => row.intrinsic.length === 0)
  const intrinsicSpread = rows.length - scored.length

  const identical = scored.filter((row) => row.ratio === 1).length
  const nearIdentical = scored.filter(
    (row) => row.ratio < 1 && row.ratio >= NEAR_IDENTICAL_THRESHOLD,
  ).length
  const divergent = scored.filter((row) => row.ratio < NEAR_IDENTICAL_THRESHOLD).length

  const meanRatio =
    scored.length === 0
      ? 1
      : round2(scored.reduce((sum, row) => sum + row.ratio, 0) / scored.length)
  const minRatio = scored.length === 0 ? 1 : Math.min(...scored.map((row) => row.ratio))

  const widest = [...rows].sort(
    (a, b) => b.asymmetry - a.asymmetry || a.name.localeCompare(b.name),
  )[0]
  const maxAsymmetry = widest
    ? { name: widest.name, ratio: widest.asymmetry, byFramework: widest.byFramework }
    : null

  return {
    caveat:
      'Visibility metric, NOT a parity guarantee. Per-framework contracts are ' +
      'intentionally idiomatic (Vue modelValue/update:modelValue, Solid onChange, ' +
      'Svelte callback props), so a low nameIntersection can mean "named differently" ' +
      'rather than "missing". A high surfaceAsymmetry is the stronger signal: naming ' +
      'idiom cannot explain a wide prop-count gap. Always read the target ' +
      "framework's own contract before generating code.",
    threshold: NEAR_IDENTICAL_THRESHOLD,
    identical,
    nearIdentical,
    divergent,
    incomparable,
    intrinsicSpread,
    propTotals,
    exclusivePropNames,
    meanRatio,
    minRatio,
    maxAsymmetry,
    worst: [...scored]
      .filter((row) => row.ratio < 1)
      .sort((a, b) => a.ratio - b.ratio || a.name.localeCompare(b.name))
      .slice(0, WORST_OFFENDER_LIMIT),
  }
}

/** Attach `parity` to each component in place (deterministic, skips incomparable). */
export function annotateComponentParity(components: ManifestComponent[]): void {
  for (const component of components) {
    if (!isComparable(component)) continue
    component.parity = computeComponentParity(component)
  }
}

/** Human-readable one-liner used by the generator console output. */
export function formatParityLine(summary: ParitySummary): string {
  const { identical, nearIdentical, divergent, incomparable, intrinsicSpread } = summary
  const worst = summary.worst[0]
  const tail = worst
    ? `; worst ${worst.name} ${Math.round(worst.ratio * 100)}% shared` +
      ` (react ${worst.byFramework.react}/vue ${worst.byFramework.vue}/` +
      `solid ${worst.byFramework.solid}/svelte ${worst.byFramework.svelte} props)`
    : ''
  return (
    `parity: ${identical} identical, ${nearIdentical} near, ${divergent} divergent` +
    (intrinsicSpread > 0 ? `, ${intrinsicSpread} intrinsic-spread` : '') +
    (incomparable > 0 ? `, ${incomparable} incomparable` : '') +
    `; mean shared ${Math.round(summary.meanRatio * 100)}%${tail}`
  )
}

/** Convenience accessor for consumers that already hold a built manifest. */
export function parityOf(manifest: IrisManifest): ParitySummary | undefined {
  return manifest.stats.parity
}

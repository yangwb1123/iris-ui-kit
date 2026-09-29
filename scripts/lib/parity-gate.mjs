/**
 * Blocking-vs-advisory classification for the cross-framework parity ratchet.
 *
 * The ratchet exists to catch *capability loss* — a prop that every adapter
 * used to expose is gone from one of them. The original rule compared the
 * shared **ratio** (shared names / union of names), which cannot tell that
 * apart from "one adapter gained props the others spell differently"
 * (Vue `modelValue`, Svelte `onchange`, a React-only `defaultChecked`): both
 * move the ratio down, but only the first is a regression. Concretely, adding
 * standalone `IrisRadio` support to React dropped `IrisRadio` 0.18 → 0.17 with
 * its shared-name count unchanged at 2, and the gate blocked real progress.
 *
 * So: a drop in the shared-name **count** blocks; a ratio move with the count
 * intact is reported as a note. Baselines recorded before `componentShared`
 * existed keep the old ratio rule, so upgrading the gate never silently
 * weakens an existing entry.
 */

/**
 * @param {{componentRatios: Record<string, number>, componentShared: Record<string, number>}} current
 * @param {{componentRatios?: Record<string, number>, componentShared?: Record<string, number>}} baseline
 * @returns {{ regressions: string[], notes: string[] }}
 */
export function classifyParity(current, baseline) {
  const regressions = []
  const notes = []

  for (const [name, shared] of Object.entries(current.componentShared ?? {})) {
    const before = baseline.componentShared?.[name]
    if (before !== undefined && shared < before) {
      regressions.push(`component ${name}: ${before} → ${shared} shared prop names lost`)
    }
  }

  for (const [name, ratio] of Object.entries(current.componentRatios ?? {})) {
    const before = baseline.componentRatios?.[name]
    if (before === undefined || ratio >= before) continue
    if (baseline.componentShared && name in baseline.componentShared) {
      notes.push(
        `component ${name}: shared ratio ${before} → ${ratio} (shared names held at ` +
          `${current.componentShared[name]}; one adapter gained framework-idiomatic props)`,
      )
      continue
    }
    regressions.push(`component ${name}: ${before} → ${ratio} (shared props decreased)`)
  }

  return { regressions, notes }
}

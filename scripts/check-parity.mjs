#!/usr/bin/env node
/**
 * Gate: cross-framework parity must not degrade.
 *
 * `check:manifest` proves each adapter *exports* a component and that its
 * props were extracted (`source: native`, `unavailable = 0`). It does not
 * compare the four adapters against each other, so a component can be
 * "native" everywhere and still be four different components.
 *
 * `stats.parity` in the generated manifest closes that blind spot. This gate
 * ratchets it: it fails only when parity gets *worse* than the recorded
 * baseline, mirroring the arch-check ratchet. Improvement is always allowed,
 * so a PR that ports a prop to another adapter passes, and a PR that silently
 * drops one fails.
 *
 * Usage:
 *   node scripts/check-parity.mjs              # verify against baseline
 *   node scripts/check-parity.mjs --update     # record current numbers
 *   node scripts/check-parity.mjs --print      # report only, never fail
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyParity } from './lib/parity-gate.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = resolve(root, 'packages/manifest/manifest.json')
const baselinePath = resolve(root, 'packages/manifest/parity-baseline.json')

const update = process.argv.includes('--update')
const printOnly = process.argv.includes('--print')

if (!existsSync(manifestPath)) {
  process.stderr.write(
    'check:parity: packages/manifest/manifest.json not found — run `pnpm gen:manifest` first.\n',
  )
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const FRAMEWORKS = manifest.frameworks
const parity = manifest.stats?.parity
if (!parity) {
  process.stderr.write(
    'check:parity: manifest has no `stats.parity`. Regenerate with `pnpm gen:manifest`\n' +
      'so the parity metric is emitted, then run `node scripts/check-parity.mjs --update`.\n',
  )
  process.exit(1)
}

/**
 * Recompute parity from `frameworkContracts` — the contracts are the data, and
 * `stats.parity` is a cached roll-up of them.
 *
 * Recomputing (rather than trusting the cached numbers) means the gate cannot
 * be satisfied by a stale or hand-edited summary: if the roll-up and the
 * contracts ever disagree, that itself is a reported failure.
 */
function recompute(components, threshold) {
  const rows = []
  for (const component of components) {
    const contracts = component.frameworkContracts
    if (!contracts || FRAMEWORKS.some((fw) => !contracts[fw])) continue
    const perFramework = new Map(
      FRAMEWORKS.map((fw) => [fw, contracts[fw].props.map((p) => p.name)]),
    )
    const declarations = new Map()
    for (const names of perFramework.values()) {
      for (const name of new Set(names)) declarations.set(name, (declarations.get(name) ?? 0) + 1)
    }
    const common = [...declarations.entries()].filter(([, n]) => n === FRAMEWORKS.length).length
    const union = declarations.size
    const exclusive = {}
    for (const fw of FRAMEWORKS) {
      exclusive[fw] = [...declarations.entries()]
        .filter(([, n]) => n === 1)
        .filter(([name]) => perFramework.get(fw).includes(name)).length
    }
    // A framework forwarding its whole attribute set has nothing enumerable to
    // intersect, so its row is excluded from the buckets (mirrors parity.ts).
    const intrinsic = FRAMEWORKS.some((fw) => contracts[fw].propsSource === 'intrinsic-spread')
    rows.push({
      name: component.name,
      ratio: union === 0 ? 1 : Math.round((common / union) * 100) / 100,
      // The capability signal: how many prop NAMES all four adapters expose.
      // `ratio` alone cannot tell "lost a shared prop" from "one adapter gained
      // a prop the others spell differently" — both move the ratio down, but
      // only the first is a regression.
      shared: common,
      intrinsic,
      propTotals: Object.fromEntries(FRAMEWORKS.map((fw) => [fw, perFramework.get(fw).length])),
      exclusive,
    })
  }
  const propTotals = {}
  const exclusivePropNames = {}
  for (const fw of FRAMEWORKS) {
    propTotals[fw] = 0
    exclusivePropNames[fw] = 0
  }
  for (const row of rows) {
    for (const fw of FRAMEWORKS) {
      propTotals[fw] += row.propTotals[fw]
      exclusivePropNames[fw] += row.exclusive[fw]
    }
  }
  const scored = rows.filter((r) => !r.intrinsic)
  const identical = scored.filter((r) => r.ratio === 1).length
  const nearIdentical = scored.filter((r) => r.ratio < 1 && r.ratio >= threshold).length
  return {
    identical,
    nearIdentical,
    divergent: scored.filter((r) => r.ratio < threshold).length,
    incomparable: components.length - rows.length,
    intrinsicSpread: rows.length - scored.length,
    meanRatio:
      scored.length === 0
        ? 1
        : Math.round((scored.reduce((s, r) => s + r.ratio, 0) / scored.length) * 100) / 100,
    propTotals,
    exclusivePropNames,
    componentRatios: Object.fromEntries(
      scored.map((r) => [r.name, r.ratio]).sort(([a], [b]) => a.localeCompare(b)),
    ),
    componentShared: Object.fromEntries(
      scored.map((r) => [r.name, r.shared]).sort(([a], [b]) => a.localeCompare(b)),
    ),
  }
}

const current = recompute(manifest.components, parity.threshold)

// The cached roll-up must agree with the contracts it claims to summarise.
const drift = []
const compare = (label, now, then) => {
  if (JSON.stringify(now) !== JSON.stringify(then))
    drift.push(
      `${label}: contracts say ${JSON.stringify(now)}, stats.parity says ${JSON.stringify(then)}`,
    )
}
compare('identical', current.identical, parity.identical)
compare('nearIdentical', current.nearIdentical, parity.nearIdentical)
compare('divergent', current.divergent, parity.divergent)
compare('incomparable', current.incomparable, parity.incomparable)
compare('intrinsicSpread', current.intrinsicSpread, parity.intrinsicSpread)
compare('meanRatio', current.meanRatio, parity.meanRatio)
compare('propTotals', current.propTotals, parity.propTotals)
compare('exclusivePropNames', current.exclusivePropNames, parity.exclusivePropNames)
if (drift.length > 0) {
  process.stderr.write(
    `\ncheck:parity: manifest roll-up is stale or hand-edited\n` +
      drift.map((line) => `  ✗ ${line}\n`).join('') +
      `\nRegenerate with \`pnpm gen:manifest\`, then re-run this gate.\n`,
  )
  process.exit(1)
}

/** The subset of numbers that must never get worse. */
const baselineShape = {
  schema: 'iris-ui/parity-baseline@1',
  threshold: parity.threshold,
  ...current,
}

const report = (line) => process.stdout.write(`${line}\n`)

report(
  `parity: ${current.identical} identical · ${current.nearIdentical} near · ` +
    `${current.divergent} divergent · mean ${Math.round(current.meanRatio * 100)}% shared`,
)
report(`  prop declarations: ${JSON.stringify(current.propTotals)}`)
report(`  single-framework prop names: ${JSON.stringify(current.exclusivePropNames)}`)

if (printOnly) process.exit(0)

if (update || !existsSync(baselinePath)) {
  if (!existsSync(baselinePath) && !update) {
    process.stderr.write(
      'check:parity: no baseline found. Recording the current numbers.\n' +
        'Review them, then commit packages/manifest/parity-baseline.json.\n',
    )
  }
  writeFileSync(baselinePath, `${JSON.stringify(baselineShape, null, 2)}\n`)
  report('  → baseline recorded (packages/manifest/parity-baseline.json)')
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const regressions = []
const advisories = []

const atLeast = (label, now, then) => {
  if (now < then) regressions.push(`${label}: ${then} → ${now} (decreased)`)
}
const atMost = (label, now, then) => {
  if (now > then) regressions.push(`${label}: ${then} → ${now} (increased)`)
}
const advise = (label, now, then) => {
  if (now > then) advisories.push(`${label}: ${then} → ${now} (increased)`)
}
const note = (line) => process.stdout.write(`  note: ${line}\n`)

atLeast('identical', current.identical, baseline.identical)
atLeast('nearIdentical', current.nearIdentical, baseline.nearIdentical)
atMost('divergent', current.divergent, baseline.divergent)
atLeast('meanRatio', current.meanRatio, baseline.meanRatio)
// Prop removal is the unambiguous capability-loss signal: a framework declaring
// fewer props than before cannot have gained surface.
for (const [framework, count] of Object.entries(current.propTotals)) {
  atLeast(`propTotals.${framework}`, count, baseline.propTotals?.[framework] ?? 0)
}
// A NEW single-framework prop name is ambiguous: it can be a genuinely new
// capability on one adapter, or simply an adapter-idiomatic prop with no
// counterpart elsewhere (Solid's `ref`, Svelte's `onclick`). Failing here would
// punish correct idiomatic work — porting `asChild` to a new adapter also
// introduces that adapter's idiomatic `ref` — so it advises instead of blocking.
for (const [framework, count] of Object.entries(current.exclusivePropNames)) {
  advise(`exclusivePropNames.${framework}`, count, baseline.exclusivePropNames?.[framework] ?? 0)
}
// Capability loss blocks; a ratio move with the shared count intact is a note.
const parityVerdict = classifyParity(current, baseline)
regressions.push(...parityVerdict.regressions)
for (const line of parityVerdict.notes) note(line)

// A brand-new component starts unrecorded; require it to be reviewed rather
// than silently inheriting a free pass.
for (const name of Object.keys(current.componentRatios)) {
  if (baseline.componentRatios && !(name in baseline.componentRatios)) {
    report(
      `  note: new component ${name} (ratio ${current.componentRatios[name]}) added to baseline`,
    )
  }
}

if (regressions.length > 0) {
  process.stderr.write(
    `\ncheck:parity: ${regressions.length} parity regression(s)\n` +
      regressions.map((line) => `  ✗ ${line}\n`).join('') +
      `\nCross-framework parity must not get worse. Either port the capability to the\n` +
      `other adapters, or (if a baseline entry is wrong) re-record with:\n` +
      `  node scripts/check-parity.mjs --update\n` +
      `Note: this metric counts prop NAMES. Per-framework naming is intentionally\n` +
      `idiomatic, so verify a real capability loss before treating a hit as a bug.\n`,
  )
  process.exit(1)
}

if (advisories.length > 0) {
  report('')
  report('  advisory (not blocking):')
  for (const line of advisories) report(`    · ${line}`)
  report(
    '    A new single-framework prop name is ambiguous — a new capability on one\n' +
      '    adapter, or an adapter-idiomatic prop (Solid `ref`, Svelte `onclick`) with\n' +
      '    no counterpart elsewhere. Verify it is intended, then re-record with:\n' +
      '      node scripts/check-parity.mjs --update',
  )
}

report(`  → no regression against baseline (${baseline.identical} identical recorded)`)

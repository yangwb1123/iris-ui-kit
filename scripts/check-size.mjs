#!/usr/bin/env node
// Bundle-size budget gate (ROADMAP #5). Gzips each library's built ESM entry
// and fails if it exceeds its budget — a tripwire against the "components keep
// getting fatter" regression. Zero dependencies (node:zlib); run after build:
//
//   pnpm turbo run build && pnpm size
//
// Budgets are gzipped KB of dist/index.js, set with headroom above the current
// size. Raise a budget deliberately (in a reviewed commit) when a real feature
// grows a package — that visibility is the point.
import { gzipSync } from 'node:zlib'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Gzipped-KB budget per package entry. */
const BUDGETS = {
  // Bumped 13→14 (R33): the dir-3 a11y/i18n sweep adds component-facing default
  // copy to defaultMessages (calendar/select/table/commandPalette/alert/banner/
  // chip/toast …) so labels are localizable via t(). Real feature surface, not
  // drift; headroom left for the remaining keys in the sweep.
  core: 14,
  tokens: 2,
  theme: 3.5,
  skins: 5,
  icons: 4,
  react: 80,
  vue: 88,
  solid: 85,
  svelte: 6,
  manifest: 2,
}

const KB = 1024
let failed = false
const rows = []

for (const [pkg, budgetKb] of Object.entries(BUDGETS)) {
  const entry = join(repoRoot, 'packages', pkg, 'dist', 'index.js')
  if (!existsSync(entry)) {
    rows.push({ pkg, status: 'MISSING', detail: 'dist/index.js not found — run build first' })
    failed = true
    continue
  }
  const gzipKb = gzipSync(readFileSync(entry)).length / KB
  const over = gzipKb > budgetKb
  if (over) failed = true
  rows.push({
    pkg,
    status: over ? 'OVER' : 'ok',
    detail: `${gzipKb.toFixed(1)}KB / ${budgetKb}KB gzip`,
  })
}

const pad = (s, n) => String(s).padEnd(n)
// eslint-disable-next-line no-console
console.log('\nBundle size budget (gzip)\n' + '─'.repeat(48))
for (const r of rows) {
  const mark = r.status === 'ok' ? '✓' : '✗'
  // eslint-disable-next-line no-console
  console.log(`${mark} ${pad('@iris-ui/' + r.pkg, 20)} ${pad(r.status, 8)} ${r.detail}`)
}
// eslint-disable-next-line no-console
console.log('─'.repeat(48))

if (failed) {
  // eslint-disable-next-line no-console
  console.error('\n✗ size budget exceeded — trim the change or raise the budget deliberately.\n')
  process.exit(1)
}
// eslint-disable-next-line no-console
console.log('\n✓ all packages within budget\n')

#!/usr/bin/env node
/**
 * Cross-shell parity check for the desktop-OS demo. The React shell
 * (`apps/desktop-os`) is the reference; the Vue / Solid / Svelte shells must stay
 * in lock-step on the user-facing surface. This codifies that requirement so it
 * can't silently drift:
 *
 *   1. identical app catalog — same set of app ids, and the same `kind` per id;
 *   2. identical OS-skin set — the same `OS_ORDER` in every shell's `os.ts`.
 *
 * Pure text parsing (no bundling): the catalogs are hand-written literals with a
 * stable shape, so a focused regex pass is robust and dependency-free.
 *
 * Run: `node scripts/check-desktop-parity.mjs` (exit 1 on any mismatch).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REFERENCE = 'desktop-os'
const SHELLS = ['desktop-os', 'desktop-os-vue', 'desktop-os-solid', 'desktop-os-svelte']

/** Recursively read every source file under a shell's `src`, joined into one blob. */
function readSrcBlob(shell) {
  const root = join(ROOT, 'apps', shell, 'src')
  let blob = ''
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (/\.(ts|tsx|vue|svelte)$/.test(ent.name) && !/\.test\./.test(ent.name)) {
        blob += `\n/* ${ent.name} */\n` + readFileSync(p, 'utf8')
      }
    }
  }
  walk(root)
  return blob
}

/**
 * The functional-requirement surface every shell must carry — each entry is a
 * marker (component filename or an API symbol) that must appear in the shell's
 * source. Keeps the four shells honest beyond just the catalog/skin sets: the
 * agent layer, persistence, permissions, and all per-OS chrome must be present.
 * See apps/desktop-os/REQUIREMENTS.md for the human-readable acceptance matrix.
 */
const FEATURES = [
  ['Assistant (agent)', /Assistant\.(tsx|vue|svelte)/],
  ['Agent Tools (MCP view)', /AgentTools\.(tsx|vue|svelte)/],
  ['LLM planner transport', /createAnthropicCall/],
  ['LLM planner (tool-use)', /createLlmPlanner/],
  ['Parameterized command', /system:search/],
  ['Command palette (⌘K)', /CommandPalette\.(tsx|vue|svelte)/],
  ['App Store / aggregation', /AppStore\.(tsx|vue|svelte)/],
  ['Permissions model', /useGrants|PERMISSION_META/],
  ['Settings app', /Settings\.(tsx|vue|svelte)|SettingsView/],
  ['Remote app kind', /loadRemoteApp/],
  ['Session persistence', /serializeSession/],
  ['Notifications', /createNotificationCenter/],
  ['macOS chrome: MenuBar', /MenuBar\.(tsx|vue|svelte)/],
  ['macOS chrome: Dock', /Dock\.(tsx|vue|svelte)/],
  ['macOS chrome: Spotlight', /Spotlight\.(tsx|vue|svelte)/],
  ['KDE chrome: Panel', /Panel\.(tsx|vue|svelte)/],
  ['KDE chrome: Kickoff', /Kickoff\.(tsx|vue|svelte)/],
  ['Snap Assist preview', /SnapPreview\.(tsx|vue|svelte)/],
  ['Desktop context menu', /ContextMenu\.(tsx|vue|svelte)/],
  ['Keyboard shortcuts', /altKey[\s\S]{0,200}?Tab|Alt\+Tab/],
]

/** Pair every `id: '…'` catalog entry with the `kind: '…'` that follows it. */
function parseCatalog(shell) {
  const src = readFileSync(join(ROOT, 'apps', shell, 'src', 'catalog.ts'), 'utf8')
  const re = /id:\s*'([^']+)'[\s\S]*?kind:\s*'(component|link|iframe|remote)'/g
  const map = {}
  let m
  while ((m = re.exec(src))) map[m[1]] = m[2]
  return map
}

/** Extract the OS_ORDER array literal from a shell's os.ts. */
function parseOsOrder(shell) {
  const src = readFileSync(join(ROOT, 'apps', shell, 'src', 'os.ts'), 'utf8')
  const m = src.match(/OS_ORDER[^=]*=\s*\[([^\]]*)\]/)
  if (!m) return []
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

const catalogs = Object.fromEntries(SHELLS.map((s) => [s, parseCatalog(s)]))
const osOrders = Object.fromEntries(SHELLS.map((s) => [s, parseOsOrder(s)]))
const blobs = Object.fromEntries(SHELLS.map((s) => [s, readSrcBlob(s)]))

const ref = catalogs[REFERENCE]
const refIds = Object.keys(ref).sort()
const refOrder = osOrders[REFERENCE]
const problems = []

// Every shell (incl. the reference) must carry the full functional surface.
const featureMisses = {}
for (const shell of SHELLS) {
  const missing = FEATURES.filter(([, re]) => !re.test(blobs[shell])).map(([name]) => name)
  featureMisses[shell] = missing
  for (const name of missing) problems.push(`${shell}: missing functional requirement — ${name}`)
}

for (const shell of SHELLS) {
  if (shell === REFERENCE) continue
  const ids = Object.keys(catalogs[shell]).sort()
  const missing = refIds.filter((id) => !ids.includes(id))
  const extra = ids.filter((id) => !refIds.includes(id))
  if (missing.length) problems.push(`${shell}: missing apps vs ${REFERENCE}: ${missing.join(', ')}`)
  if (extra.length) problems.push(`${shell}: extra apps not in ${REFERENCE}: ${extra.join(', ')}`)
  for (const id of refIds) {
    const k = catalogs[shell][id]
    if (k && k !== ref[id]) problems.push(`${shell}: app '${id}' kind '${k}' ≠ '${ref[id]}'`)
  }
  if (osOrders[shell].join(',') !== refOrder.join(',')) {
    problems.push(`${shell}: OS_ORDER [${osOrders[shell]}] ≠ [${refOrder}]`)
  }
}

const fmt = (n) => String(n).padStart(2)
console.log('🖥️  desktop-os cross-shell parity')
console.log(
  `   reference: ${REFERENCE} — ${fmt(refIds.length)} apps, skins [${refOrder.join(', ')}], ${FEATURES.length} features`,
)
for (const shell of SHELLS) {
  if (shell === REFERENCE) continue
  const feats = FEATURES.length - featureMisses[shell].length
  console.log(
    `   ${shell.padEnd(20)} ${fmt(Object.keys(catalogs[shell]).length)} apps, skins [${osOrders[shell].join(', ')}], ${feats}/${FEATURES.length} features`,
  )
}

if (problems.length) {
  console.error('\n❌ parity violations:')
  for (const p of problems) console.error(`   - ${p}`)
  process.exit(1)
}
console.log(
  `\n✅ all shells in parity — same ${refIds.length} apps + kinds + OS skins + all ${FEATURES.length} functional requirements`,
)

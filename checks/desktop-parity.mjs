#!/usr/bin/env node

/**
 * checks/desktop-parity.mjs — Cross-shell desktop-OS parity check.
 *
 * The React shell (`apps/desktop-os`) is the reference; the Vue/Solid/Svelte
 * shells must stay in lock-step on:
 *   1. App catalog — same set of app ids + kinds
 *   2. OS skin set — same OS_ORDER array
 *   3. Functional requirement surface (Assistant, Agent, permissions, etc.)
 *
 * Migration from scripts/check-desktop-parity.mjs.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

const FEATURES = [
  ['Assistant (agent)', /Assistant\.(tsx|vue|svelte)/],
  ['Agent Tools (MCP view)', /AgentTools\.(tsx|vue|svelte)/],
  ['LLM planner transport', /createAnthropicCall/],
  ['LLM planner (tool-use)', /createLlmPlanner/],
  ['Command palette (⌘K)', /CommandPalette\.(tsx|vue|svelte)/],
  ['App Store / aggregation', /AppStore\.(tsx|vue|svelte)/],
  ['Permissions model', /useGrants|PERMISSION_META/],
  ['Settings app', /Settings\.(tsx|vue|svelte)|SettingsView/],
  ['Remote app kind', /loadRemoteApp/],
  ['Session persistence', /serializeSession/],
  ['Notifications', /createNotificationCenter/],
  ['Clipboard manager', /createClipboardHistory/],
  ['Virtual desktops', /setWorkspace/],
  ['Virtual file system', /createVirtualFs/],
  ['macOS chrome: MenuBar', /MenuBar\.(tsx|vue|svelte)/],
  ['macOS chrome: Dock', /Dock\.(tsx|vue|svelte)/],
  ['macOS chrome: Spotlight', /Spotlight\.(tsx|vue|svelte)/],
  ['KDE chrome: Panel', /Panel\.(tsx|vue|svelte)/],
  ['KDE chrome: Kickoff', /Kickoff\.(tsx|vue|svelte)/],
  ['Snap Assist preview', /SnapPreview\.(tsx|vue|svelte)/],
  ['Desktop context menu', /ContextMenu\.(tsx|vue|svelte)/],
  ['Keyboard shortcuts', /altKey[\s\S]{0,200}?Tab|Alt\+Tab/],
]

function readSrcBlob(root) {
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

function parseCatalog(filePath) {
  const src = readFileSync(filePath, 'utf8')
  const re = /id:\s*'([^']+)'[\s\S]*?kind:\s*'(component|link|iframe|remote)'/g
  const map = {}
  let m
  while ((m = re.exec(src))) map[m[1]] = m[2]
  return map
}

function parseOsOrder(filePath) {
  const src = readFileSync(filePath, 'utf8')
  const m = src.match(/OS_ORDER[^=]*=\s*\[([^\]]*)\]/)
  if (!m) return []
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])
}

export async function run() {
  const cfg = getConfig()
  const { reference, shells } = cfg.desktop_parity

  const catalogs = {}
  const osOrders = {}
  const blobs = {}

  console.log('--- Desktop OS cross-shell parity check ---\n')

  for (const shell of shells) {
    const srcDir = resolve(ROOT, 'apps', shell, 'src')
    const catalogFile = join(srcDir, 'catalog.ts')
    const osFile = join(srcDir, 'os.ts')

    try {
      catalogs[shell] = parseCatalog(catalogFile)
    } catch {
      catalogs[shell] = {}
      console.log(`  ⚠️  ${shell}: catalog.ts not found or unreadable`)
    }

    try {
      osOrders[shell] = parseOsOrder(osFile)
    } catch {
      osOrders[shell] = []
      console.log(`  ⚠️  ${shell}: os.ts not found or unreadable`)
    }

    blobs[shell] = readSrcBlob(srcDir)
  }

  const ref = catalogs[reference]
  const refIds = Object.keys(ref).sort()
  const refOrder = osOrders[reference]
  const problems = []

  // Feature presence
  for (const shell of shells) {
    const missing = FEATURES.filter(([, re]) => !re.test(blobs[shell])).map(([name]) => name)
    for (const name of missing) {
      problems.push(`${shell}: missing functional requirement — ${name}`)
    }
  }

  // App catalog parity
  for (const shell of shells) {
    if (shell === reference) continue
    const ids = Object.keys(catalogs[shell]).sort()
    const missing = refIds.filter(id => !ids.includes(id))
    const extra = ids.filter(id => !refIds.includes(id))
    if (missing.length) problems.push(`${shell}: missing apps vs ${reference}: ${missing.join(', ')}`)
    if (extra.length) problems.push(`${shell}: extra apps not in ${reference}: ${extra.join(', ')}`)
    for (const id of refIds) {
      const k = catalogs[shell][id]
      if (k && k !== ref[id]) problems.push(`${shell}: app '${id}' kind '${k}' ≠ '${ref[id]}'`)
    }
  }

  // OS skins parity
  for (const shell of shells) {
    if (shell === reference) continue
    if (osOrders[shell].join(',') !== refOrder.join(',')) {
      problems.push(`${shell}: OS_ORDER [${osOrders[shell].join(',')}] ≠ [${refOrder.join(',')}]`)
    }
  }

  // Report
  for (const shell of shells) {
    const feats = FEATURES.length - FEATURES.filter(([, re]) => !re.test(blobs[shell])).length
    const apps = Object.keys(catalogs[shell]).length
    console.log(`  ${shell.padEnd(24)} ${String(apps).padStart(3)} apps, skins [${osOrders[shell].join(', ')}], ${feats}/${FEATURES.length} features`)
  }

  if (problems.length > 0) {
    console.error('\n❌ Parity violations:')
    for (const p of problems) console.error(`   - ${p}`)
    return 1
  }

  console.log(`\n✅ all shells in parity — same ${refIds.length} apps + kinds + OS skins + all ${FEATURES.length} features`)
  return 0
}
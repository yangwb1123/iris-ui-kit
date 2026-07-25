#!/usr/bin/env node

/**
 * checks/architecture.mjs — Architecture dependency direction gate.
 *
 * Enforces:
 *   1. Core package (@iris-ui/core) must NOT import any framework package
 *      (react, vue, solid-js, svelte).
 *   2. Plugin core modules must NOT import any framework package.
 *   3. Framework adapters must NOT import other frameworks.
 *
 * Rules loaded from iris.yaml (architecture: section).
 * Migration from scripts/arch-check.mjs (dependency check portion).
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

function collectGoFiles(dir) {
  // Collect TypeScript/JS files in packages/ for import checking
  const results = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
          results.push(...collectGoFiles(full))
        }
      } else if (entry.isFile() && /\.(ts|tsx|vue|svelte)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        results.push(full)
      }
    }
  } catch { /* skip */ }
  return results
}

/**
 * Check if a file imports any forbidden dependency.
 * Returns array of violation strings.
 */
function checkFile(file, forbiddenDeps, root) {
  const rel = relative(root, file)
  let content
  try {
    content = readFileSync(file, 'utf-8')
  } catch { return [] }

  const violations = []
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    // Match: import ... from 'X' or require('X')
    let match
    const importMatch = trimmed.match(/from\s+['"]([^'"]+)['"]/)
    const requireMatch = trimmed.match(/require\(['"]([^'"]+)['"]\)/)

    const dep = importMatch?.[1] || requireMatch?.[1]
    if (!dep) continue

    for (const forbidden of forbiddenDeps) {
      if (dep === forbidden || dep.startsWith(forbidden + '/')) {
        violations.push(`  FAIL: ${rel} imports '${dep}' (forbidden: ${forbidden})`)
      }
    }
  }

  return violations
}

export async function run(opts = {}) {
  const cfg = getConfig()
  const { forbidden_imports, plugin_rules } = cfg.architecture

  console.log('--- Architecture dependency check ---')
  let violations = []
  let totalChecked = 0

  // 1. Check per-source forbidden imports (e.g., core → no framework)
  for (const rule of forbidden_imports) {
    const sourceDir = resolve(ROOT, rule.source)
    if (!sourceDir.startsWith(ROOT)) continue

    const files = collectGoFiles(sourceDir)
    totalChecked += files.length

    for (const file of files) {
      violations.push(...checkFile(file, rule.forbidden, ROOT))
    }
  }

  // 2. Check plugin rules (plugin core modules → no framework)
  for (const rule of plugin_rules) {
    const pattern = rule.pattern
    // Match plugin directories
    const pluginsDir = resolve(ROOT, 'packages')
    try {
      const entries = readdirSync(pluginsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith('plugin-')) continue
        const pluginCoreDir = resolve(pluginsDir, entry.name, 'src', 'core')
        if (pluginCoreDir.startsWith(ROOT)) {
          try {
            const files = readdirSync(pluginCoreDir, { withFileTypes: true })
            for (const f of files) {
              if (f.isFile() && /\.(ts|tsx)$/.test(f.name)) {
                totalChecked++
                violations.push(...checkFile(resolve(pluginCoreDir, f.name), rule.forbidden, ROOT))
              }
            }
          } catch { /* core dir doesn't exist */ }
        }
      }
    } catch { /* skip */ }
  }

  // 3. Remove duplicates and print
  const unique = [...new Set(violations)]
  for (const v of unique.sort()) console.log(v)

  if (unique.length > 0) {
    console.log(`\nFAIL: ${unique.length} architecture violation(s) found`)
    console.log(`Checked ${totalChecked} files`)
    return 1
  }

  console.log(`  PASS: no forbidden imports (${totalChecked} files checked)`)
  return 0
}
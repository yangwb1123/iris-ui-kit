#!/usr/bin/env node

/**
 * skills/architecture-fix/run.mjs — Detect and fix architecture violations.
 *
 * Scans for imports that violate the project's architecture rules
 * (e.g., framework code importing from another framework, files importing
 * from forbidden packages). Provides actionable fix suggestions.
 *
 * Usage: node cli.mjs skill architecture-fix [--dir packages/react/src]
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const ROOT = __dirname

const FORBIDDEN_PATTERNS = [
  // Core must not import any framework
  { pattern: /packages\/core\/src/, forbid: ['react', 'vue', 'solid-js', 'svelte', '@iris-ui/react', '@iris-ui/vue', '@iris-ui/solid', '@iris-ui/svelte'], msg: 'core must not import framework packages' },
  // React must not import Vue/Solid/Svelte
  { pattern: /packages\/react\/src/, forbid: ['vue', 'solid-js', 'svelte', '@iris-ui/vue', '@iris-ui/solid', '@iris-ui/svelte'], msg: 'react must not import other framework adapters' },
  // Vue must not import React/Solid/Svelte
  { pattern: /packages\/vue\/src/, forbid: ['react', 'solid-js', 'svelte', '@iris-ui/react', '@iris-ui/solid', '@iris-ui/svelte'], msg: 'vue must not import other framework adapters' },
  // Solid must not import React/Vue/Svelte
  { pattern: /packages\/solid\/src/, forbid: ['react', 'vue', 'svelte', '@iris-ui/react', '@iris-ui/vue', '@iris-ui/svelte'], msg: 'solid must not import other framework adapters' },
  // Svelte must not import React/Vue/Solid
  { pattern: /packages\/svelte\/src/, forbid: ['react', 'vue', 'solid-js', '@iris-ui/react', '@iris-ui/vue', '@iris-ui/solid'], msg: 'svelte must not import other framework adapters' },
]

function walkFiles(dir) {
  const files = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...walkFiles(full))
      } else if (/\.(ts|tsx|vue|svelte)$/.test(entry.name)) {
        files.push(full)
      }
    }
  } catch { /* skip */ }
  return files
}

function extractImports(content) {
  const imports = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/from\s+['"](.+?)['"]/)
    if (m) imports.push({ source: m[1], line: i + 1 })
  }
  return imports
}

export async function run(args = []) {
  const targetDir = args.find(a => !a.startsWith('--')) || 'packages'
  const targetPath = resolve(ROOT, targetDir)

  console.log('=== Architecture Fix ===\n')
  console.log(`  Scanning: ${targetDir}/\n`)

  const files = walkFiles(targetPath)
  let violations = 0

  for (const file of files) {
    const relPath = relative(ROOT, file)
    const content = readFileSync(file, 'utf-8')
    const imports = extractImports(content)

    for (const rule of FORBIDDEN_PATTERNS) {
      if (!rule.pattern.test(relPath)) continue

      for (const imp of imports) {
        const isForbidden = rule.forbid.some(f => imp.source === f || imp.source.startsWith(f + '/'))
        if (!isForbidden) continue

        violations++
        console.log(`  ✗ ${relPath}:${imp.line}`)
        console.log(`    Import: ${imp.source}`)
        console.log(`    Issue:  ${rule.msg}`)
        console.log(`    Fix:    Remove the import or move shared logic to @iris-ui/core\n`)
      }
    }
  }

  if (violations === 0) {
    console.log('  ✅ No architecture violations found.\n')
  } else {
    console.log(`  ${violations} violation(s) found.\n`)
  }

  return violations > 0 ? 1 : 0
}
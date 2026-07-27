#!/usr/bin/env node

/**
 * checks/license.mjs — License header check.
 *
 * Verifies that all source files have the required license header.
 * Based on the project's license header template.
 *
 * Usage: node cli.mjs check-license [--fix]
 *   --fix: Add missing license headers automatically
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

const LICENSE_HEADER = `// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2024 Iris UI Contributors
`

const EXTENSIONS = ['.ts', '.tsx', '.vue', '.svelte', '.js', '.jsx']
const IGNORE_DIRS = ['node_modules', 'dist', '.turbo', '.svelte-kit', '.next', 'coverage', '.git']

function walkFiles(dir) {
  const files = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.includes(entry.name) && !entry.name.startsWith('.')) {
          files.push(...walkFiles(full))
        }
      } else if (EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
        files.push(full)
      }
    }
  } catch { /* skip */ }
  return files
}

export async function run(opts = {}) {
  const args = process.argv.slice(3)
  const fixMode = args.includes('--fix')

  console.log('--- License Header Check ---\n')

  const srcDirs = ['packages/core/src', 'packages/react/src', 'packages/vue/src',
                   'packages/solid/src', 'packages/svelte/src',
                   'packages/tokens/src', 'packages/theme/src', 'packages/skins/src']

  let missing = 0
  let fixed = 0

  for (const dir of srcDirs) {
    const fullPath = resolve(ROOT, dir)
    const files = walkFiles(fullPath)

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const relPath = relative(ROOT, file)

      // Check if license header is present in first 5 lines
      const firstLines = content.split('\n').slice(0, 5).join('\n')
      if (!firstLines.includes('SPDX-License-Identifier')) {
        missing++

        if (fixMode) {
          const updated = LICENSE_HEADER + '\n' + content
          writeFileSync(file, updated)
          fixed++
          console.log(`  + ${relPath}`)
        } else {
          console.log(`  ✗ ${relPath}`)
        }
      }
    }
  }

  if (missing === 0) {
    console.log('  ✓ All source files have license headers.\n')
    return 0
  }

  if (fixMode) {
    console.log(`\n  ✓ Added ${fixed} missing license headers.\n`)
    return 0
  }

  console.log(`\n  ❌ ${missing} file(s) missing license headers.`)
  console.log('  Run with --fix to auto-add.\n')
  return 1
}
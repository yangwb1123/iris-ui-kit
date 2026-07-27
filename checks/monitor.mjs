#!/usr/bin/env node

/**
 * checks/monitor.mjs — File watcher that auto-re-runs checks on change.
 *
 * Uses node:fs.watch to monitor source directories and re-run specified
 * checks when files change. Useful during development for instant feedback.
 *
 * Usage: node cli.mjs monitor [check1 check2 ...]
 *   Default: check-filesize, check-architecture, check-format
 *   Example: node cli.mjs monitor check-framework check-tokens
 */

import { watch } from 'node:fs'
import { resolve, relative } from 'node:path'
import { execSync } from 'node:child_process'
import { getConfig, ROOT } from './config.mjs'

const DEFAULT_CHECKS = ['check-filesize', 'check-architecture', 'check-format']
const WATCH_DIRS = [
  'packages/core/src',
  'packages/react/src',
  'packages/vue/src',
  'packages/solid/src',
  'packages/svelte/src',
]

export async function run(opts = {}) {
  const args = process.argv.slice(3).filter(a => !a.startsWith('--'))
  const checks = args.length > 0 ? args : DEFAULT_CHECKS
  const debounceMs = 300

  console.log('═'.repeat(48))
  console.log('  Iris UI Monitor — Watching for changes')
  console.log('═'.repeat(48))
  console.log()
  console.log(`  Watching ${WATCH_DIRS.length} source directories`)
  console.log(`  Triggers: ${checks.join(', ')}`)
  console.log(`  Debounce: ${debounceMs}ms`)
  console.log('  Press Ctrl+C to stop\n')

  const fullDirs = WATCH_DIRS.map(d => resolve(ROOT, d))
  let timer = null
  let pending = false

  function runChecks() {
    if (pending) return
    pending = true
    timer = setTimeout(() => {
      pending = false
      console.log(`\n  [${new Date().toLocaleTimeString()}] Change detected — running checks...\n`)
      for (const check of checks) {
        const start = Date.now()
        try {
          execSync(`node cli.mjs ${check}`, { cwd: ROOT, stdio: 'pipe', timeout: 15000 })
          console.log(`  ✓ ${check} (${Date.now() - start}ms)`)
        } catch {
          console.log(`  ✗ ${check} (${Date.now() - start}ms)`)
        }
      }
      console.log(`\n  [${new Date().toLocaleTimeString()}] Watching...\n`)
    }, debounceMs)
  }

  for (const dir of fullDirs) {
    try {
      watch(dir, { recursive: true }, (eventType, filename) => {
        if (filename && !filename.includes('node_modules') && !filename.startsWith('.')) {
          runChecks()
        }
      })
      console.log(`  Watching: ${relative(ROOT, dir)}/`)
    } catch (err) {
      console.log(`  ⚠️  Cannot watch ${dir}: ${err.message}`)
    }
  }

  console.log('\n  Watching...\n')

  // Keep alive
  await new Promise(() => {})
  return 0
}
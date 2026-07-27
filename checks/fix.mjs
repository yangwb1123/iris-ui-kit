#!/usr/bin/env node

/**
 * checks/fix.mjs — Auto-fix common engineering issues.
 *
 * Run: node cli.mjs fix <issue>
 *
 * Available fixes:
 *   format       — Run prettier --write on packages/
 *   manifest     — Regenerate manifest.json and llms.txt
 *   tokens       — Regenerate token documentation
 *   all          — Run all available fixes
 */

import { execSync } from 'node:child_process'
import { getConfig, ROOT } from './config.mjs'

const FIXES = {
  format: {
    description: 'Run prettier --write on packages/',
    run: async () => {
      execSync('npx prettier --write "packages/**/*.{ts,tsx,vue,svelte,js,json,css,html}"', {
        cwd: ROOT, stdio: 'inherit', timeout: 30000,
      })
    }
  },
  manifest: {
    description: 'Regenerate manifest.json and llms.txt',
    run: async () => {
      execSync('pnpm gen:manifest', { cwd: ROOT, stdio: 'inherit', timeout: 30000 })
    }
  },
  tokens: {
    description: 'Regenerate token documentation',
    run: async () => {
      execSync('pnpm audit:tokens', { cwd: ROOT, stdio: 'inherit', timeout: 30000 })
    }
  },
}

export async function run(opts = {}) {
  const args = process.argv.slice(3)
  const fixName = args[0] || 'help'

  if (fixName === 'help' || fixName === '--help') {
    console.log('Available fixes:\n')
    for (const [key, fix] of Object.entries(FIXES)) {
      console.log(`  ${key.padEnd(16)} ${fix.description}`)
    }
    console.log(`  ${'all'.padEnd(16)} Run all available fixes`)
    console.log()
    return 0
  }

  if (fixName === 'all') {
    console.log('=== Running all fixes ===\n')
    for (const [key, fix] of Object.entries(FIXES)) {
      process.stdout.write(`  [${key}] ${fix.description} ... `)
      try {
        await fix.run()
        console.log('✓')
      } catch {
        console.log('✗')
      }
    }
    console.log('\nFixes complete.\n')
    return 0
  }

  if (!FIXES[fixName]) {
    console.error(`Unknown fix: '${fixName}'`)
    console.error('Usage: node cli.mjs fix <name>')
    console.error('Run "node cli.mjs fix help" to list available fixes.\n')
    return 1
  }

  console.log(`Running fix: ${fixName} (${FIXES[fixName].description})\n`)
  try {
    await FIXES[fixName].run()
    console.log('\n✓ Fix applied.\n')
    return 0
  } catch {
    console.log('\n✗ Fix failed.\n')
    return 1
  }
}
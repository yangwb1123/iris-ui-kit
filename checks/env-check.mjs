#!/usr/bin/env node

/**
 * checks/env-check.mjs — Prerequisite environment check.
 *
 * Verifies that all required tools and build artifacts exist before running
 * expensive operations. Prevents cryptic "command not found" errors.
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

function checkTool(name, cmd) {
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 5000 })
    return true
  } catch { return false }
}

function checkDir(path) {
  return existsSync(resolve(ROOT, path))
}

export async function run() {
  const cfg = getConfig()
  console.log('--- Environment Prerequisite Check ---\n')

  const checks = [
    { name: 'pnpm',          ok: checkTool('pnpm', 'pnpm --version') },
    { name: 'Node.js ≥20',   ok: process.version.startsWith('v2') || Number(process.version.slice(1).split('.')[0]) >= 20 },
    { name: 'Git',           ok: checkTool('git', 'git --version') },
    { name: 'TypeScript',    ok: checkTool('tsc', 'npx tsc --version') },
    { name: 'Prettier',      ok: checkTool('prettier', 'npx prettier --version') },
    { name: 'js-yaml',       ok: checkDir('node_modules/js-yaml') },
  ]

  // Check dist artifacts if needed
  if (process.argv.includes('--check-build')) {
    const pkgs = Object.keys(cfg.size.budgets)
    for (const pkg of pkgs) {
      const dir = pkg.replace(/^@iris-ui-kit\//, '')
      checks.push({
        name: `dist/${dir}`,
        ok: checkDir(`packages/${dir}/dist/index.js`),
      })
    }
  }

  let passed = 0
  let failed = 0

  for (const check of checks) {
    const mark = check.ok ? '✓' : '✗'
    console.log(`  ${mark} ${check.name}`)
    if (check.ok) passed++
    else failed++
  }

  console.log(`\n  ${passed}/${checks.length} checks passed`)

  if (failed > 0) {
    console.log('\n❌ Some prerequisites are missing.\n')
    return 1
  }

  console.log('\n✅ All prerequisites met.\n')
  return 0
}

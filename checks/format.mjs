#!/usr/bin/env node

/**
 * checks/format.mjs — Prettier format check.
 *
 * Runs prettier --check on source files (scoped to packages/ for speed).
 * Migration from `pnpm format:check` script, but scoped to avoid timeout.
 */

import { execSync } from 'node:child_process'
import { ROOT } from './config.mjs'

export async function run() {
  const scope = `"${ROOT}/packages/**/*.{ts,tsx,vue,svelte,js,json,css,html}"`

  console.log('--- Prettier format check ---')

  try {
    execSync(`pnpm exec prettier --check ${scope}`, {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: 120000,
    })
    console.log('PASS: format (packages/)')
    return 0
  } catch {
    console.log('FAIL: run `pnpm format` to fix formatting')
    return 1
  }
}

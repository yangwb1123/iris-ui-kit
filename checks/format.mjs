#!/usr/bin/env node

/**
 * checks/format.mjs — Prettier format check.
 *
 * Runs prettier --check on source files (scoped to packages/ for speed).
 * Migration from `pnpm format:check` script, but scoped to avoid timeout.
 */

import { execSync } from 'node:child_process'
import { getConfig, ROOT } from './config.mjs'

export async function run() {
  const cfg = getConfig()
  const scope = `"${ROOT}/packages/**/*.{ts,tsx,vue,svelte,js,json,css,html}"`

  console.log('--- Prettier format check ---')

  try {
    execSync(`npx prettier --check ${scope}`, {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: 30000,
    })
    console.log('PASS: format (packages/)')
    return 0
  } catch {
    console.log('FAIL: run `pnpm format` to fix formatting')
    return 1
  }
}
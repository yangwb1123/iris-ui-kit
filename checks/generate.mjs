#!/usr/bin/env node

/**
 * checks/generate.mjs — Regenerate engineering scaffolding.
 *
 * Currently delegates to the manifest generator (`pnpm gen:manifest`).
 * Can be extended to regenerate baselines, docs, etc.
 */

import { execSync } from 'node:child_process'
import { ROOT } from './config.mjs'

export async function run() {
  console.log('--- Generate Engineering Scaffolding ---')

  try {
    execSync('pnpm gen:manifest', { cwd: ROOT, stdio: 'inherit', timeout: 60000 })
    console.log('✓ Manifest regenerated')
    return 0
  } catch (err) {
    console.error('✗ Manifest generation failed:', err.message)
    return 1
  }
}
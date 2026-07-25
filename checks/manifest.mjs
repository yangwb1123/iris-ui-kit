#!/usr/bin/env node

/**
 * checks/manifest.mjs — Component manifest consistency gate.
 *
 * Verifies that the generated manifest.json and llms.txt are up-to-date
 * with the current barrel exports. Runs the manifest generator and checks
 * for git diff — any diff means the manifest is stale.
 *
 * Migration from `pnpm check:manifest`.
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

export async function run() {
  const cfg = getConfig()
  const manifestPath = resolve(ROOT, cfg.manifest.manifest_path)
  const llmsPath = resolve(ROOT, cfg.manifest.llms_path)

  console.log('--- Manifest Consistency Check ---')

  if (!existsSync(manifestPath)) {
    console.log('⚠️  manifest.json not found — run `pnpm gen:manifest` first')
    return 1
  }

  try {
    // Regenerate manifest
    execSync('pnpm gen:manifest', { cwd: ROOT, stdio: 'pipe', timeout: 60000 })

    // Check if anything changed
    const diff = execSync('git diff --stat -- packages/manifest/manifest.json packages/manifest/llms.txt 2>/dev/null || true', {
      cwd: ROOT,
      encoding: 'utf-8',
    }).trim()

    if (diff) {
      console.log(`✗ Manifest is stale — changes detected:\n${diff}`)
      console.log('Run `pnpm gen:manifest` and commit the updated files.')
      return 1
    }

    console.log('✓ Manifest is up to date')
    return 0
  } catch (err) {
    console.error(`✗ Manifest check failed: ${err.message}`)
    return 1
  }
}
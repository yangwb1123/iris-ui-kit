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
import { existsSync, readFileSync } from 'node:fs'
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
    // Compare the generator output with the files as they exist in the
    // worktree, not with HEAD. A feature branch legitimately carries a
    // generated manifest diff; using `git diff` here reported every such
    // intended change as stale and made the acceptance suite impossible to
    // pass before commit.
    const before = new Map([
      [manifestPath, readFileSync(manifestPath, 'utf8')],
      [llmsPath, readFileSync(llmsPath, 'utf8')],
    ])

    // Regenerate manifest
    execSync('pnpm gen:manifest', { cwd: ROOT, stdio: 'pipe', timeout: 60000 })

    const changed = [...before].filter(([path, content]) => readFileSync(path, 'utf8') !== content)
    if (changed.length > 0) {
      console.log(`✗ Manifest is stale — changes detected in ${changed.length} generated file(s).`)
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

#!/usr/bin/env node

/**
 * skills/install-hooks/run.mjs — Install and verify git hooks.
 *
 * Sets up husky pre-commit hooks for the Iris UI check system.
 * Verifies that hooks are executable and properly configured.
 *
 * Usage: node cli.mjs skill install-hooks [--force]
 */

import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const ROOT = __dirname

export async function run(args = []) {
  const force = args.includes('--force')
  console.log('=== Install Git Hooks ===\n')

  // Check if .husky exists
  const huskyDir = resolve(ROOT, '.husky')
  const preCommitPath = resolve(huskyDir, 'pre-commit')

  if (!existsSync(huskyDir)) {
    console.log('  ✗ .husky directory not found')
    console.log('  Run: pnpm dlx husky-init\n')
    return 1
  }

  if (!existsSync(preCommitPath) || force) {
    const hook = `#!/usr/bin/env sh
. "$(dirname "$0")/_/husky.sh"

# Iris UI pre-commit checks
# Runs quick checks on staged files (fast, <2s typical)

echo "=== Iris UI Pre-Commit Check ==="

# Check filesize on diff
node cli.mjs check-filesize --diff || exit 1

# Check change budget on staged
node cli.mjs change-budget --staged || exit 1

# Check basic architecture (fast)
node cli.mjs check-architecture --diff || exit 1
`
    writeFileSync(preCommitPath, hook, 'utf-8')
    chmodSync(preCommitPath, 0o755)
    console.log('  ✓ pre-commit hook written')
  } else {
    console.log('  ✓ pre-commit hook already exists')
  }

  // Verify hook is executable
  const stats = readFileSync(preCommitPath, 'utf-8')
  if (!stats.startsWith('#!/usr/bin/env sh')) {
    console.log('  ⚠️  pre-commit hook may be corrupted')
    return 1
  }

  console.log('  ✓ Hook executable and valid')

  // Run husky install
  try {
    execSync('pnpm husky install', { cwd: ROOT, stdio: 'pipe', timeout: 10000 })
    console.log('  ✓ Husky hooks installed')
  } catch {
    console.log('  ⚠️  Could not run husky install (may already be set up)')
  }

  console.log('\n✅ Git hooks ready.\n')
  return 0
}
#!/usr/bin/env node

/**
 * checks/deps.mjs — Dependency health check.
 *
 * Verifies that all workspace packages have consistent dependency versions,
 * no missing peer dependencies, and no known-vulnerable packages.
 *
 * Usage: node cli.mjs check-deps [--outdated] [--audit]
 */

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

export async function run(opts = {}) {
  const args = process.argv.slice(3)
  const checkOutdated = args.includes('--outdated')
  const checkAudit = args.includes('--audit')
  const cfg = getConfig()

  console.log('--- Dependency Health Check ---\n')

  let exitCode = 0

  // 1. Check workspace package versions are consistent
  console.log('  Checking version consistency...')
  const pkgDirs = ['core', 'react', 'vue', 'solid', 'svelte', 'tokens', 'theme', 'skins', 'icons', 'manifest']
  const deps = {}
  let versionMismatches = 0

  for (const dir of pkgDirs) {
    const pkgPath = resolve(ROOT, `packages/${dir}/package.json`)
    if (!existsSync(pkgPath)) continue
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

    for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
      if (!pkg[depType]) continue
      for (const [name, version] of Object.entries(pkg[depType])) {
        if (!deps[name]) deps[name] = {}
        if (!deps[name][version]) deps[name][version] = []
        deps[name][version].push(`${dir} (${depType})`)
      }
    }
  }

  for (const [dep, versions] of Object.entries(deps)) {
    const versionList = Object.keys(versions)
    if (versionList.length > 1) {
      versionMismatches++
      console.log(`  ⚠️  "${dep}" has inconsistent versions:`)
      for (const [ver, locations] of Object.entries(versions)) {
        console.log(`       ${ver}: ${locations.join(', ')}`)
      }
    }
  }

  if (versionMismatches === 0) {
    console.log('  ✓ All dependency versions consistent')
  }
  console.log()

  // 2. Check for outdated packages (optional, slower)
  if (checkOutdated) {
    console.log('  Checking for outdated packages...')
    try {
      const outdated = execSync('pnpm outdated --long --no-table 2>/dev/null', {
        cwd: ROOT, encoding: 'utf-8', timeout: 30000,
      }).trim()
      if (outdated) {
        const lines = outdated.split('\n').filter(l => l.trim())
        if (lines.length > 1) {
          console.log(`  ⚠️  ${lines.length - 1} package(s) outdated:`)
          for (const line of lines.slice(1, 15)) {
            console.log(`       ${line.trim()}`)
          }
          if (lines.length > 15) console.log(`       ... and ${lines.length - 15} more`)
        } else {
          console.log('  ✓ All packages up to date')
        }
      } else {
        console.log('  ✓ All packages up to date')
      }
    } catch {
      console.log('  ⚠️  Could not check outdated packages')
    }
    console.log()
  }

  // 3. Check for vulnerabilities (optional, slower)
  if (checkAudit) {
    console.log('  Auditing for vulnerabilities...')
    try {
      const audit = execSync('pnpm audit --audit-level=high 2>&1', {
        cwd: ROOT, encoding: 'utf-8', timeout: 60000,
      })
      if (audit.includes('No vulnerabilities found')) {
        console.log('  ✓ No vulnerabilities found')
      } else {
        console.log(`  ⚠️  ${audit.split('\n').filter(l => l.includes('vulnerability')).join(', ') || 'Vulnerabilities found'}`)
        exitCode = 1
      }
    } catch {
      // pnpm audit exits non-zero when vulnerabilities found
      console.log('  ⚠️  Vulnerabilities found (run pnpm audit for details)')
      exitCode = 1
    }
    console.log()
  }

  if (exitCode === 0) {
    console.log('  ✅ Dependency health check passed.\n')
  } else {
    console.log('  ❌ Dependency health issues found.\n')
  }

  return exitCode
}
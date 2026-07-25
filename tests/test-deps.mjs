#!/usr/bin/env node

/**
 * tests/test-deps.mjs — Test suite for checks/deps.mjs
 *
 * Run: node tests/test-deps.mjs
 */

import { strict as assert } from 'node:assert'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`)
    failed++
  }
}

console.log('\n--- Dependency Check Tests ---\n')

test('deps.mjs exports run()', async () => {
  const mod = await import('../checks/deps.mjs')
  assert.equal(typeof mod.run, 'function')
})

test('all workspace packages have package.json', () => {
  const pkgDirs = ['core', 'react', 'vue', 'solid', 'svelte', 'tokens', 'theme', 'skins', 'icons', 'manifest']
  for (const dir of pkgDirs) {
    const pkgPath = resolve(ROOT, `packages/${dir}/package.json`)
    assert.ok(existsSync(pkgPath), `package.json should exist for ${dir}`)
  }
})

test('all package.json files are valid JSON', () => {
  const pkgDirs = ['core', 'react', 'vue', 'solid', 'svelte', 'tokens', 'theme', 'skins', 'icons', 'manifest']
  for (const dir of pkgDirs) {
    const pkgPath = resolve(ROOT, `packages/${dir}/package.json`)
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      assert.ok(pkg.name, `${dir} should have a name field`)
      assert.ok(pkg.name.startsWith('@iris-ui/'), `${dir} should be @iris-ui/*`)
    } catch (err) {
      assert.fail(`${dir} package.json parse error: ${err.message}`)
    }
  }
})

test('core package has no framework dependencies', () => {
  const corePkg = JSON.parse(readFileSync(resolve(ROOT, 'packages/core/package.json'), 'utf-8'))
  const deps = { ...corePkg.dependencies, ...corePkg.devDependencies, ...corePkg.peerDependencies }
  for (const dep of Object.keys(deps || {})) {
    assert.ok(!['react', 'vue', 'solid-js', 'svelte'].includes(dep),
      `core should not depend on ${dep}`)
  }
})

test('all packages reference @iris-ui/core consistently', () => {
  const pkgDirs = ['react', 'vue', 'solid', 'svelte']
  for (const dir of pkgDirs) {
    const pkgPath = resolve(ROOT, `packages/${dir}/package.json`)
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const coreDep = pkg.dependencies?.['@iris-ui/core'] || pkg.peerDependencies?.['@iris-ui/core']
    assert.ok(coreDep, `${dir} should depend on @iris-ui/core`)
    // Version should be a workspace protocol
    assert.ok(coreDep.startsWith('workspace:'), `${dir} @iris-ui/core should use workspace: protocol, got "${coreDep}"`)
  }
})

console.log(`\n  ${passed}/${passed + failed} tests passed\n`)
process.exit(failed > 0 ? 1 : 0)
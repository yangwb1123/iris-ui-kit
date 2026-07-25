#!/usr/bin/env node

/**
 * checks/pack-install.mjs — External pack+npm-install smoke check.
 *
 * Packs curated @iris-ui packages into real npm tarballs, installs them via
 * plain `npm install` (outside the pnpm workspace), and verifies the installed
 * modules resolve. Catches "exports map stale" / "files missing from tarball"
 * regressions.
 *
 * Migration from scripts/check-pack-install.mjs.
 * Curated package list from iris.yaml (pack_install: section).
 */

import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

function readPkg(dir) {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
}

export async function run() {
  const cfg = getConfig()
  const { curated_packages, raw_import_check, exports_resolve_check } = cfg.pack_install
  const packagesDir = resolve(ROOT, 'packages')

  // Verify dist exists for all curated packages
  for (const dir of curated_packages) {
    if (!existsSync(join(packagesDir, dir, 'dist'))) {
      console.error(`✗ packages/${dir}/dist not found — run \`pnpm build\` first.`)
      return 1
    }
  }

  // Resolve closure: all @iris-ui/* deps across the curated set
  const irisDeps = (dir) =>
    Object.keys(readPkg(join(packagesDir, dir)).dependencies || {})
      .filter(d => d.startsWith('@iris-ui/'))
      .map(d => d.slice('@iris-ui/'.length))

  const closure = new Set(curated_packages)
  const queue = [...curated_packages]
  while (queue.length) {
    const dir = queue.shift()
    for (const dep of irisDeps(dir)) {
      if (!closure.has(dep)) { closure.add(dep); queue.push(dep) }
    }
  }
  const ALL = [...closure]

  console.log('\nExternal pack + npm install smoke check\n' + '─'.repeat(48))

  let scratchDir
  let failed = false
  try {
    scratchDir = mkdtempSync(join(tmpdir(), 'iris-pack-install-'))
    const tarballDir = join(scratchDir, 'tarballs')
    mkdirSync(tarballDir)

    // 1. pnpm pack each package
    const tarballs = {}
    for (const dir of ALL) {
      const res = spawnSync('pnpm', ['pack', '--json', '--pack-destination', tarballDir], {
        cwd: join(packagesDir, dir),
        encoding: 'utf8',
      })
      if (res.status !== 0) {
        failed = true
        console.error(`✗ pnpm pack failed for packages/${dir}: ${res.stderr}`)
        continue
      }
      tarballs[dir] = JSON.parse(res.stdout).filename
    }
    if (failed) return 1

    // 2. Create test package.json with file: deps
    const dependencies = {}
    for (const dir of ALL) dependencies[readPkg(join(packagesDir, dir)).name] = `file:${tarballs[dir]}`
    writeFileSync(
      join(scratchDir, 'package.json'),
      JSON.stringify({ name: 'iris-pack-test', version: '0.0.0', private: true, dependencies }, null, 2),
    )

    // 3. npm install (outside pnpm workspace)
    const npmEnv = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !/^npm_config_/i.test(k)),
    )
    const install = spawnSync('npm', ['install'], { cwd: scratchDir, encoding: 'utf8', env: npmEnv })
    const installOk = install.status === 0
    if (!installOk) {
      console.error(`✗ npm install failed:\n${install.stderr}`)
      return 1
    }

    // 4. Smoke test: import precompiled packages
    for (const dir of raw_import_check) {
      const name = readPkg(join(packagesDir, dir)).name
      const smokeFile = join(scratchDir, 'smoke.mjs')
      writeFileSync(smokeFile, `
const name = ${JSON.stringify(name)};
try {
  const mod = await import(name);
  const ok = !!mod && typeof mod === 'object' && Object.keys(mod).length > 0;
  process.stdout.write(ok ? 'ok' : 'no-exports');
} catch(e) {
  process.stdout.write('error: ' + (e.message || e));
}
process.exit(0);
`)
      const smoke = spawnSync('node', [smokeFile], { cwd: scratchDir, encoding: 'utf8' })
      const result = smoke.stdout.trim()
      if (result === 'ok') {
        console.log(`✓ ${name.padEnd(22)} import ok`)
      } else {
        console.log(`✗ ${name.padEnd(22)} import FAILED: ${result}`)
        failed = true
      }
    }

    // 5. Exports resolve check (for packages that ship raw source, like svelte)
    for (const dir of exports_resolve_check) {
      const name = readPkg(join(packagesDir, dir)).name
      const installedDir = join(scratchDir, 'node_modules', name)
      if (!existsSync(installedDir)) {
        console.log(`✗ ${name.padEnd(22)} not installed`)
        failed = true
        continue
      }

      const collectExportPaths = (node, out = []) => {
        if (typeof node === 'string') { if (node.startsWith('./')) out.push(node) }
        else if (node && typeof node === 'object') { for (const v of Object.values(node)) collectExportPaths(v, out) }
        return out
      }

      try {
        const installedPkg = JSON.parse(readFileSync(join(installedDir, 'package.json'), 'utf8'))
        const paths = collectExportPaths(installedPkg.exports)
        for (const key of ['main', 'svelte', 'module']) {
          if (typeof installedPkg[key] === 'string' && installedPkg[key].startsWith('./')) {
            paths.push(installedPkg[key])
          }
        }
        const unique = [...new Set(paths)]
        const missing = unique.filter(p => !existsSync(join(installedDir, p)))
        if (missing.length > 0) {
          console.log(`✗ ${name.padEnd(22)} missing exports: ${missing.join(', ')}`)
          failed = true
        } else {
          console.log(`✓ ${name.padEnd(22)} exports ok (${unique.length} paths)`)
        }
      } catch (err) {
        console.log(`✗ ${name.padEnd(22)} check failed: ${err.message}`)
        failed = true
      }
    }

    return failed ? 1 : 0
  } finally {
    if (scratchDir) { try { rmSync(scratchDir, { recursive: true, force: true }) } catch { /* best-effort */ } }
  }
}
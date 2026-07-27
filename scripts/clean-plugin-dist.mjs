#!/usr/bin/env node
/* global console */

// Multi-config tsup builds must not use `clean: true`: each concurrent DTS
// rollup removes every declaration in the shared outDir and can erase another
// config's output. Clean once, before tsup starts, with a narrowly-scoped guard.
import { rmSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packagesRoot = resolve(repoRoot, 'packages')
const packageDir = resolve(process.cwd())
const packageName = basename(packageDir)

if (dirname(packageDir) !== packagesRoot || !packageName.startsWith('plugin-')) {
  throw new Error(
    `clean-plugin-dist: refusing to clean outside a direct packages/plugin-* directory: ${packageDir}`,
  )
}

const distDir = resolve(packageDir, 'dist')
rmSync(distDir, { recursive: true, force: true })
console.log(`clean-plugin-dist: reset packages/${packageName}/dist`)

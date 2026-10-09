#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// Node 20 does not expand a quoted --test glob. Discover the same direct-child
// *.test.mjs suite explicitly, without depending on shell/platform globbing.
const directory = new URL('./lib/', import.meta.url)
const tests = readdirSync(directory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.mjs'))
  .map((entry) => fileURLToPath(new URL(entry.name, directory)))
  .sort()
if (tests.length === 0) throw new Error('No script tests found; refusing an empty gate')
const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1

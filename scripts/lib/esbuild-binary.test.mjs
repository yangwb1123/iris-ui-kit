/**
 * `check-size.mjs` used to hard-code `node_modules/.bin/esbuild`, which under
 * pnpm is a `/bin/sh` shim that Node cannot spawn here. The enforced
 * per-icon tree-shaking probe then reported "unmeasurable" and failed the gate
 * with an environment problem dressed up as a size regression.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { esbuildCandidates, esbuildPlatform, findEsbuild, isRunnable } from './esbuild-binary.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('platform package name is derived from platform AND arch', () => {
  // process.platform is 'darwin'/'linux'; using it alone yields no candidate.
  assert.equal(esbuildPlatform('darwin', 'arm64'), 'darwin-arm64')
  assert.equal(esbuildPlatform('darwin', 'x64'), 'darwin-x64')
  assert.equal(esbuildPlatform('linux', 'x64'), 'linux-x64')
  assert.equal(esbuildPlatform('win32', 'x64'), 'win32')
  assert.equal(esbuildPlatform('freebsd', 'x64'), null)
  assert.equal(esbuildPlatform(), esbuildPlatform(process.platform, process.arch))
})

test('candidates put real platform binaries ahead of the .bin shim', () => {
  const candidates = esbuildCandidates(root)
  assert.ok(candidates.length >= 1)
  const shim = join(root, 'node_modules', '.bin', 'esbuild')
  if (candidates.includes(shim)) {
    assert.equal(candidates.at(-1), shim, 'the shim must be the last resort')
  }
})

test('every candidate that exists is either runnable or explicitly reported', () => {
  const result = findEsbuild(root)
  if (result.bin === null) {
    // Fail closed: the caller must be able to explain *why* it could not run.
    assert.ok(result.tried.length > 0)
    assert.ok(
      result.tried.every((entry) => entry.includes('missing') || entry.includes('not runnable')),
    )
    return
  }
  assert.equal(isRunnable(result.bin), true)
  assert.ok(existsSync(result.bin))
})

test('isRunnable rejects a non-executable path instead of throwing', () => {
  assert.equal(isRunnable(join(root, 'package.json')), false)
  assert.equal(isRunnable(join(root, 'definitely-missing-binary')), false)
})

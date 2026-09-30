/**
 * Regression tests for `pnpmCommand()`.
 *
 * The bug this guards: pnpm's *native* distribution (standalone binary) reports
 * `npm_execpath=/…/@pnpm/exe.<platform>/pnpm` — a compiled executable whose
 * name carries no extension. Routing that through `node` dies with
 * `SyntaxError: Invalid or unexpected token` and a non-zero exit status, which
 * every caller reads as "the gate found drift". The fix (only reuse
 * `npm_execpath` when it is a `.cjs/.mjs/.js` entry) is invisible to a Linux CI
 * runner using corepack, so it needs its own portable test.
 *
 * Run: node --test scripts/lib/
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pnpmCommand, pnpmSpawnArgs } from './run-pnpm.mjs'

const SHELL_COMMAND = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : '/bin/sh'

test('JS pnpm entry point is reused through the current Node binary', () => {
  const { command, args } = pnpmCommand({
    npm_execpath: '/usr/local/lib/node_modules/pnpm/bin/pnpm.cjs',
  })
  assert.equal(command, process.execPath)
  assert.deepEqual(args, ['/usr/local/lib/node_modules/pnpm/bin/pnpm.cjs'])
})

test('mjs pnpm entry point is also reused through Node', () => {
  const { command, args } = pnpmCommand({ npm_execpath: '/opt/pnpm/bin/pnpm.mjs' })
  assert.equal(command, process.execPath)
  assert.deepEqual(args, ['/opt/pnpm/bin/pnpm.mjs'])
})

test('JS entry receives each pnpm CLI argument as a separate argv item', () => {
  const { args } = pnpmCommand({ npm_execpath: '/opt/pnpm/bin/pnpm.mjs' })
  assert.deepEqual(pnpmSpawnArgs(args, ['--filter', 'ssr-nuxt', 'build']), [
    '/opt/pnpm/bin/pnpm.mjs',
    '--filter',
    'ssr-nuxt',
    'build',
  ])
})

test('shell fallback keeps a single quoted command string', () => {
  const { args } = pnpmCommand({})
  assert.deepEqual(
    pnpmSpawnArgs(args, ['--filter', 'ssr-nuxt', 'build']),
    process.platform === 'win32'
      ? [args[0], 'pnpm --filter ssr-nuxt build']
      : [args[0], "'pnpm' '--filter' 'ssr-nuxt' 'build'"],
  )
})

test('native pnpm binary is NOT handed to node (it would be a SyntaxError)', () => {
  const { command, args } = pnpmCommand({
    npm_execpath: '/Users/x/lib/node_modules/pnpm/node_modules/@pnpm/exe.darwin-arm64/pnpm',
  })
  assert.notEqual(command, process.execPath, 'native binary must not go through node')
  assert.equal(command, SHELL_COMMAND)
  assert.deepEqual(args, process.platform === 'win32' ? ['/d /s /c'] : ['-c'])
})

test('no npm_execpath falls back to the shell wrapper', () => {
  assert.equal(pnpmCommand({}).command, SHELL_COMMAND)
  assert.equal(pnpmCommand({ npm_execpath: '' }).command, SHELL_COMMAND)
})

test('a JS path that merely mentions pnpm is not mistaken for the entry point', () => {
  // The old heuristic (`…/pnpm(.cjs|.mjs)?$`) also accepted unrelated files
  // such as a workspace script; the new rule is purely "is it JavaScript".
  const { command } = pnpmCommand({ npm_execpath: '/repo/scripts/pnpm' })
  assert.equal(command, SHELL_COMMAND)
})

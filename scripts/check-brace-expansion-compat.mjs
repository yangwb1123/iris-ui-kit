import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Temporary bridge for GHSA-mh99-v99m-4gvg:
// package.json overrides vulnerable brace-expansion 1/2 installs to the safe
// 5.x line. The CommonJS entry changed from a callable export to an object with
// a named `expand` function; both shapes are supported by minimatch consumers.
// Keep this check until upstream maintenance releases for lines 1 and 2 include
// the bounded expansion fix without the workspace override.

const workspaceRoot = fileURLToPath(new URL('..', import.meta.url))
const pnpmStore = join(workspaceRoot, 'node_modules', '.pnpm')

function requireFromMinimatch(version) {
  return createRequire(
    join(pnpmStore, `minimatch@${version}`, 'node_modules', 'minimatch', 'package.json'),
  )
}

const minimatchRequires = new Map(
  ['3.1.5', '9.0.9', '10.2.5'].map((version) => [version, requireFromMinimatch(version)]),
)
const modernRequire = minimatchRequires.get('10.2.5')
assert(modernRequire)

const cjsBrace = modernRequire('brace-expansion')
const bracePackageRoot = dirname(modernRequire.resolve('brace-expansion/package.json'))
const esmBrace = await import(pathToFileURL(join(bracePackageRoot, 'dist', 'esm', 'index.js')).href)
const cjsExpand = typeof cjsBrace === 'function' ? cjsBrace : cjsBrace.expand

assert.equal(typeof cjsExpand, 'function', 'CommonJS export must expose a callable expand function')
if (typeof cjsBrace === 'function') {
  assert.equal(cjsBrace.expand, cjsBrace, 'callable CommonJS .expand must reference the export')
}
assert.equal(typeof esmBrace.expand, 'function', 'ESM must retain its named expand export')
assert.equal(cjsBrace.EXPANSION_MAX, esmBrace.EXPANSION_MAX)
assert.equal(cjsBrace.EXPANSION_MAX_LENGTH, esmBrace.EXPANSION_MAX_LENGTH)

const expansionCases = [
  ['list', '{red,blue}', ['red', 'blue']],
  ['range', '{1..3}', ['1', '2', '3']],
  ['nested', 'x{a,{b,c}}y', ['xay', 'xby', 'xcy']],
  ['escaped braces', String.raw`a\{b,c\}`, ['a{b,c}']],
  ['escaped comma', String.raw`{a\,b,c}`, ['a,b', 'c']],
]

for (const [label, pattern, expected] of expansionCases) {
  assert.deepEqual(cjsExpand(pattern), expected, `CommonJS ${label} expansion`)
  assert.deepEqual(esmBrace.expand(pattern), expected, `ESM ${label} expansion`)
}

assert.deepEqual(cjsExpand('{a,b,c}', { max: 2 }), ['a', 'b'])
assert.deepEqual(cjsExpand('{a,b,c}', { maxLength: 2 }), ['a', 'b'])
assert(cjsBrace.EXPANSION_MAX > 0)
assert(cjsBrace.EXPANSION_MAX_LENGTH > cjsBrace.EXPANSION_MAX)

for (const [version, localRequire] of minimatchRequires) {
  const { Minimatch } = localRequire('minimatch')
  const matcher = new Minimatch('src/{one,{two,three}}.ts')
  assert.equal(matcher.match('src/one.ts'), true, `minimatch ${version}: list`)
  assert.equal(matcher.match('src/two.ts'), true, `minimatch ${version}: nested`)
  assert.equal(matcher.match('src/three.ts'), true, `minimatch ${version}: nested tail`)
  assert.equal(matcher.match('src/four.ts'), false, `minimatch ${version}: rejection`)
}

console.log('brace-expansion 5.x compatibility check passed (CJS/ESM, minimatch 3/9/10)')

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import process from 'node:process'
import { test } from 'node:test'

const root = createRequire(new URL('../../package.json', import.meta.url))
let consumer = createRequire(root.resolve('@changesets/cli'))
for (const name of ['@manypkg/get-packages', 'globby', 'fast-glob', 'micromatch']) {
  consumer = createRequire(consumer.resolve(name))
}
const braces = consumer('braces')
const micromatch = consumer('micromatch')

test('real workspace discovery resolves the audited, depth-guarded braces implementation', () => {
  const manifest = consumer('braces/package.json')
  assert.equal(manifest.name, '@dieub/braces-depth-guard')
  assert.equal(manifest.version, '3.0.3-pn.3')
})

test('brace expansion, escaping and ordinary package glob language remain usable', () => {
  assert.deepEqual(braces.expand('{a,b}/{1..3}'), ['a/1', 'a/2', 'a/3', 'b/1', 'b/2', 'b/3'])
  assert.deepEqual(braces.expand('v{3..1}'), ['v3', 'v2', 'v1'])
  assert.deepEqual(braces.expand('x\\{a,b\\}'), ['x{a,b}'])
  const names = ['@iris/a', '@iris/b', '@iris/c', 'plain']
  assert.deepEqual(micromatch(names, ['@iris/{a,b}', '!@iris/b']), ['@iris/a'])
  assert.deepEqual(micromatch(names, ['@iris/[ab]']), ['@iris/a', '@iris/b'])
  assert.deepEqual(micromatch(names, ['@iris/!(c)']), ['@iris/a', '@iris/b'])
})

test('all public recursive braces traversals reject deep direct ASTs without bypass options', () => {
  let ast = { type: 'text', value: 'a' }
  for (let i = 0; i < 150; i++)
    ast = { type: 'brace', nodes: [ast], commas: 1, open: true, close: true }
  ast = { type: 'root', nodes: [ast] }
  for (const method of ['compile', 'expand', 'stringify']) {
    assert.throws(() => braces[method](ast, { maxDepth: Infinity }), /depth|nested/i)
  }
  assert.throws(
    () => braces.parse('{'.repeat(101) + 'a' + '}'.repeat(101), { maxDepth: Infinity }),
    /depth|nested/i,
  )
  assert.throws(() => braces.parse('a'.repeat(10001), { maxLength: Infinity }), /length/i)
})

test('deep hostile string stays bounded in the actual micromatch brace expansion path', () => {
  const script = `const requireActual=require('node:module').createRequire(process.argv[1]);
    const mm=requireActual('micromatch');
    try{mm.braceExpand('{'.repeat(20000)+'a'+'}'.repeat(20000));process.exitCode=1}
    catch(error){if(!/length|depth|nested/i.test(error.message)||/call stack/i.test(error.message)){console.error(error.message.slice(0,300));process.exitCode=2}}
  `
  const result = spawnSync(process.execPath, ['-e', script, consumer.resolve('micromatch')], {
    encoding: 'utf8',
    timeout: 3000,
    maxBuffer: 4096,
  })
  assert.equal(result.status, 0, result.stderr || String(result.error))
})

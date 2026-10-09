import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { test } from 'node:test'

const root = createRequire(new URL('../../package.json', import.meta.url))
const cli = createRequire(root.resolve('@changesets/cli'))
const configRequire = createRequire(cli.resolve('@changesets/config'))
const { parse } = configRequire('@changesets/config')
const names = ['@iris/a', '@iris/b', '@iris/c', 'plain', 'private']
const packages = {
  root: { dir: '/fixture', packageJson: { name: 'root', private: true } },
  tool: 'pnpm',
  packages: names.map((name) => ({
    dir: `/fixture/${name}`,
    packageJson: { name, version: '1.0.0', private: name === 'private' },
  })),
}

// The installed CLI's config parser is the consumer, not a renamed glob fork.
for (const [patterns, expected] of [
  [['@iris/*'], ['@iris/a', '@iris/b', '@iris/c']],
  [['@iris/{a,b}'], ['@iris/a', '@iris/b']],
  [['@iris/[ab]'], ['@iris/a', '@iris/b']],
  [['@iris/?(a|b)'], ['@iris/a', '@iris/b']],
  [
    ['@iris/*', '!@iris/b'],
    ['@iris/a', '@iris/c'],
  ],
  [['!@iris/b'], ['@iris/a', '@iris/c', 'plain', 'private']],
  [
    ['plain', '@iris/a', 'plain'],
    ['plain', '@iris/a'],
  ],
  [[], []],
]) {
  test(`Changesets ignore keeps normal glob semantics: ${JSON.stringify(patterns)}`, () => {
    assert.deepEqual(parse({ ignore: patterns }, packages).ignore, expected)
  })
}

test('Changesets fixed/linked expand groups and still reject duplicates or missing packages', () => {
  const parsed = parse({ fixed: [['@iris/{a,b}']], linked: [['plain']] }, packages)
  assert.deepEqual(parsed.fixed, [['@iris/a', '@iris/b']])
  assert.deepEqual(parsed.linked, [['plain']])
  assert.throws(() => parse({ fixed: [['@iris/*'], ['@iris/a']] }, packages), /multiple sets/)
  assert.throws(() => parse({ linked: [['missing']] }, packages), /does not match any package/)
  assert.throws(
    () => parse({ fixed: [['@iris/a']], linked: [['@iris/a']] }, packages),
    /both fixed and linked/,
  )
})

test('Changesets direct matcher uses the bounded bridge rather than recursive micromatch', () => {
  const packageDir = dirname(configRequire.resolve('@changesets/config/package.json'))
  // Node can still resolve hoisted dependencies of OTHER consumers. Check this
  // package's direct map and actual imports, not arbitrary ancestor resolution.
  const direct = resolve(packageDir, '../..')
  for (const name of ['braces', 'micromatch']) assert.equal(existsSync(join(direct, name)), false)
  for (const file of ['changesets-config.cjs.js', 'changesets-config.esm.js']) {
    assert.match(readFileSync(join(packageDir, 'dist', file), 'utf8'), /['"]\.\/patterns\.cjs['"]/)
  }
  assert.equal(configRequire('picomatch/package.json').version, '4.0.7')
})

test('Changesets hostile deep and long globs reject in a bounded isolated consumer', () => {
  const script = `
    const {createRequire}=require('node:module');
    const cli=createRequire(process.argv[1]);
    const config=cli('@changesets/config');
    const packages={root:{dir:'/fixture',packageJson:{name:'root'}},tool:'pnpm',packages:[{dir:'/fixture/a',packageJson:{name:'a',version:'1.0.0'}}]};
    for(const pattern of ['{'.repeat(20000)+'a'+'}'.repeat(20000), 'a'.repeat(65537)]){
      try{config.parse({ignore:[pattern]},packages);process.exitCode=1;break}
      catch(error){if(!/Changesets pattern budget exceeded/.test(error.message)){console.error(error.message.slice(0,200));process.exitCode=2;break}}
    }
  `
  const result = spawnSync(process.execPath, ['-e', script, root.resolve('@changesets/cli')], {
    encoding: 'utf8',
    timeout: 3000,
    maxBuffer: 4096,
  })
  assert.equal(result.status, 0, result.stderr || String(result.error))
})

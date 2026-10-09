import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { compactJavaScript, compactPublishedJavaScript } from '../compact-published-js.mjs'

const require = createRequire(import.meta.url)
const esbuild = createRequire(require.resolve('tsup'))('esbuild')
const load = (code) => import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))

const source = `
  'use client';
  // This constructor is unused by the small consumer, but cannot be removed
  // safely without retaining the explicit PURE metadata in the published file.
  export const registry = /* @__PURE__ */ new Map([['unused', 42]]);
  export class PublicController { read() { return 7; } }
  export function publicHelper(value) { return value + 1; }
  export const glyph = { name: 'glyph', nodes: [{ tag: 'path', attrs: { d: 'M0 0L1 1' } }] };
`

test('published compaction retains public names, behavior, exports and directives', async () => {
  const { code } = await compactJavaScript(source, 'fixture.js')
  const before = await load(source)
  const after = await load(code)
  assert.deepEqual(Object.keys(after), Object.keys(before))
  assert.equal(after.publicHelper.name, before.publicHelper.name)
  assert.equal(after.PublicController.name, before.PublicController.name)
  assert.equal(after.publicHelper.length, before.publicHelper.length)
  assert.equal(after.publicHelper(8), before.publicHelper(8))
  assert.equal(new after.PublicController().read(), new before.PublicController().read())
  assert.deepEqual(after.glyph, before.glyph)
  assert.deepEqual([...after.registry], [...before.registry])
  assert.match(code, /^['"]use client['"]/)
  assert.match(code, /publicHelper/)
  assert.match(code, /PublicController/)
})

test('PURE metadata survives compaction and a consumer still drops unused constructors', async () => {
  const { code } = await compactJavaScript(source, 'fixture.js')
  assert.match(code, /[@#]__PURE__/)
  const bundle = async (input) =>
    (
      await esbuild.build({
        stdin: { contents: `import { glyph } from 'fixture'; console.log(glyph)`, loader: 'js' },
        bundle: true,
        write: false,
        format: 'esm',
        minify: true,
        plugins: [
          {
            name: 'fixture',
            setup(build) {
              build.onResolve({ filter: /^fixture$/ }, () => ({
                path: 'fixture',
                namespace: 'fixture',
              }))
              build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
                contents: input,
                loader: 'js',
              }))
            },
          },
        ],
      })
    ).outputFiles[0].text
  const before = await bundle(source)
  const after = await bundle(code)
  assert.doesNotMatch(after, /Map|unused|PublicController/)
  assert.equal(gzipSync(after).length, gzipSync(before).length)
})

test('Vue component purity survives publication and removes unrelated barrel siblings', async () => {
  const componentSource = `import { defineComponent } from 'vue';
    export const Primary = /* @__PURE__ */ defineComponent({ name: 'Primary' });
    export const Unrelated = /* @__PURE__ */ defineComponent({ name: 'Unrelated' });`
  const { code } = await compactJavaScript(componentSource, 'components.js')
  const result = await esbuild.build({
    stdin: { contents: `import { Primary } from 'components'; console.log(Primary)`, loader: 'js' },
    bundle: true,
    write: false,
    format: 'esm',
    minify: true,
    external: ['vue'],
    plugins: [
      {
        name: 'components',
        setup(build) {
          build.onResolve({ filter: /^components$/ }, () => ({
            path: 'components',
            namespace: 'components',
          }))
          build.onLoad({ filter: /.*/, namespace: 'components' }, () => ({
            contents: code,
            loader: 'js',
          }))
        },
      },
    ],
  })
  assert.match(result.outputFiles[0].text, /Primary/)
  assert.doesNotMatch(result.outputFiles[0].text, /Unrelated/)
})

test('compaction composes source maps with original source content', async () => {
  const built = await esbuild.transform(source, {
    sourcefile: 'original-source.ts',
    sourcemap: 'external',
    format: 'esm',
  })
  const result = await compactJavaScript(built.code, 'fixture.js', built.map)
  const map = JSON.parse(result.map)
  assert.deepEqual(map.sources, ['original-source.ts'])
  assert.deepEqual(map.sourcesContent, [source])
  assert.ok(map.mappings.length)
  assert.match(result.code, /sourceMappingURL=fixture\.js\.map/)
})

test('dist compaction refuses empty or incomplete output without partially rewriting files', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'iris-compaction-'))
  try {
    await assert.rejects(compactPublishedJavaScript(directory), /empty compaction/)
    writeFileSync(join(directory, 'a.js'), source)
    const built = await esbuild.transform(source, {
      sourcefile: 'original.ts',
      sourcemap: 'external',
    })
    writeFileSync(join(directory, 'a.js.map'), built.map)
    writeFileSync(join(directory, 'b.cjs'), 'module.exports = 1;')
    await assert.rejects(compactPublishedJavaScript(directory), /ENOENT/)
    assert.equal(readFileSync(join(directory, 'a.js'), 'utf8'), source)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { compactJavaScript } from '../compact-published-js.mjs'

const require = createRequire(import.meta.url)
const nuxt = createRequire(require.resolve('../../apps/ssr-nuxt/node_modules/nuxt/package.json'))
const nitro = createRequire(nuxt.resolve('nitropack/package.json'))
const { createUnimport } = await import(pathToFileURL(nitro.resolve('unimport')).href)
const esbuild = createRequire(require.resolve('tsup'))('esbuild')

test('compacted declarations survive Nitro automatic imports without shadowing public icon bindings', async () => {
  const source = `var line = (x, y) => ({ x, y });
var send = { name: 'send', nodes: [line(22, 2)] };
export { line, send };`
  const { code } = await compactJavaScript(source, 'icons.js')
  const consumer = createUnimport({ imports: [{ name: 'send', from: 'h3' }] })
  const injected = await consumer.injectImports(code)
  assert.equal(injected.code, code, 'A locally declared icon must not gain a conflicting H3 import')
  await esbuild.transform(injected.code, { format: 'esm' })
  const exports = await import(
    'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
  )
  assert.deepEqual(Object.keys(exports), ['line', 'send'])
  assert.equal(exports.line.name, 'line')
  assert.equal(exports.line.length, 2)
  assert.deepEqual(exports.send, { name: 'send', nodes: [{ x: 22, y: 2 }] })
})

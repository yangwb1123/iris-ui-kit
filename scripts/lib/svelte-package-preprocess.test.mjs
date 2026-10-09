import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import config from '../../packages/svelte/svelte.config.js'

const require = createRequire(new URL('../../packages/svelte/package.json', import.meta.url))
const { compile, preprocess } = require('svelte/compiler')
const { transformWithEsbuild } = await import(require.resolve('vite'))
const filename = 'ControlSize.svelte'
const source = `<script lang="ts">
  import Input from './Input.svelte'
  import type { Snippet } from 'svelte'
  type Size = 'sm' | 'md' | 'lg'
  let { size = 'md', count = 1, children }: {
    size?: Size; count?: number; children?: Snippet
  } = $props()
  let active: boolean = $state(false)
  const doubled: number = $derived(count * 2)
  function flip(): void { active = !active }
</script>
<Input value={String(doubled)} aria-label={size} />
<button onclick={flip}>{active ? 'yes' : 'no'}</button>
{@render children?.()}`

async function canonicalCompiled(input, generate) {
  const { js } = compile(input, { filename, generate, dev: false })
  const result = await transformWithEsbuild(js.code, 'control.js', {
    minifyWhitespace: true,
    target: 'es2022',
  })
  return result.code
}

test('published Svelte scripts erase types, preserve markup-only imports and sourcemaps', async () => {
  const result = await preprocess(source, config.preprocess, { filename })
  assert.doesNotMatch(result.code, /import type|type Size|count\?: number/)
  assert.match(result.code, /import Input from/)
  assert.match(result.code, /\$props\(\)/)
  assert.match(result.code, /\$state\(false\)/)
  assert.match(result.code, /\$derived\(count \* 2\)/)
  assert.ok(result.map)
  const map = JSON.parse(result.map.toString())
  assert.ok(map.sources.some((path) => path.endsWith(filename)))
  assert.ok(map.mappings.length > 0)
})

for (const generate of ['client', 'server']) {
  test(`type erasure preserves ${generate} rune, snippet and event compilation`, async () => {
    const result = await preprocess(source, config.preprocess, { filename })
    assert.equal(
      await canonicalCompiled(result.code, generate),
      await canonicalCompiled(source, generate),
    )
  })
}

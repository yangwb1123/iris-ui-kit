/**
 * Standalone SSR renderer for the app's iris composition, run as a CHILD
 * process by `src/hydration.test.tsx`.
 *
 * Why a child process: the test runs under Vitest in a jsdom environment.
 * Spinning Vite's dev server *inside* that process fails two ways — jsdom's
 * TextEncoder/Uint8Array trip esbuild's realm invariant, and Vitest's module
 * loader rewrites `import.meta.url` to a non-`file://` URL that Vite's CJS
 * entry rejects. A clean Node child has neither problem. It creates a Vite SSR
 * server, `ssrLoadModule`s the SSR entry (compiled `generate:'ssr'` +
 * hydratable against the *server* `solid-js/web`), renders to a string, and
 * prints it to stdout for the parent to hydrate.
 *
 * vite + vite-plugin-solid are monorepo dev-deps (not app deps); resolve them
 * from absolute paths the same way the parent's resolver does.
 */
import { createRequire } from 'node:module'
import { readdirSync, writeSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL, URL } from 'node:url'

const appRoot = resolve(dirname(new URL(import.meta.url).pathname), '..')
const req = createRequire(join(appRoot, 'package.json'))

function findPnpmDir(fromPath) {
  let dir = dirname(fromPath)
  for (let i = 0; i < 12; i++) {
    const idx = dir.lastIndexOf('/.pnpm/')
    if (idx !== -1) return dir.slice(0, idx + '/.pnpm'.length)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return undefined
}

// vite — reachable through the running vitest's dependency tree. Resolve the
// package dir and use its ESM node entry (the CJS `main` doesn't export
// createServer the same way under `import()`).
const vitestEntry = req.resolve('vitest')
const viteDir = dirname(createRequire(vitestEntry).resolve('vite/package.json'))
const viteEntry = join(viteDir, 'dist/node/index.js')
const viteMajor = /vite@(\d+)\./.exec(viteDir)?.[1] ?? ''

// vite-plugin-solid — devDep of @iris-ui-kit/solid; pick the build for this vite major.
const irisPkg = req.resolve('@iris-ui-kit/solid/package.json')
let pluginEntry
try {
  pluginEntry = createRequire(irisPkg).resolve('vite-plugin-solid')
} catch {
  pluginEntry = undefined
}
const pnpmDir = findPnpmDir(viteEntry) ?? findPnpmDir(vitestEntry)
if (pnpmDir && viteMajor) {
  const match = readdirSync(pnpmDir).find(
    (name) => name.startsWith('vite-plugin-solid@') && name.includes(`_vite@${viteMajor}.`),
  )
  if (match) {
    pluginEntry = join(
      pnpmDir,
      match,
      'node_modules',
      'vite-plugin-solid',
      'dist',
      'esm',
      'index.mjs',
    )
  }
}
if (!pluginEntry) throw new Error('could not resolve vite-plugin-solid')

const { createServer } = await import(pathToFileURL(viteEntry).href)
const solid = (await import(pathToFileURL(pluginEntry).href)).default

const irisSolidSrc = resolve(appRoot, '../../packages/solid/src/index.tsx')

const server = await createServer({
  configFile: false,
  root: appRoot,
  plugins: [solid({ ssr: true })],
  resolve: { alias: { '@iris-ui-kit/solid': irisSolidSrc } },
  server: { middlewareMode: true, hmr: false },
  ssr: { noExternal: [/solid-js/, /@solidjs/, /@iris-ui-kit/] },
  optimizeDeps: { noDiscovery: true, include: [] },
  logLevel: 'silent',
})

try {
  const mod = await server.ssrLoadModule('/src/iris-tree.ssr.tsx')
  const html = mod.renderIrisTreeToString()
  // Emit the HTML between sentinels so the parent can extract it cleanly even
  // if Vite logs anything to stdout. Await the write because stdout is a
  // non-blocking pipe under execFileSync; writing the one-shot protocol payload
  // directly to stdout's file descriptor guarantees it is flushed.
  writeSync(process.stdout.fd, `\n__IRIS_SSR_START__${html}__IRIS_SSR_END__\n`)
} finally {
  await server.close()
}

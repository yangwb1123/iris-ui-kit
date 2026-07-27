import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import type { IrisManifest } from '@iris-ui-kit/manifest'

function currentModuleLocation(): string {
  if (typeof import.meta.url === 'string') return import.meta.url
  if (typeof __filename === 'string') return __filename
  throw new Error('Unable to resolve the MCP module location.')
}

/**
 * Load the generated manifest that ships inside `@iris-ui-kit/manifest`. Resolving
 * the JSON via `require.resolve` works both in the monorepo (workspace symlink)
 * and when this package is installed standalone, so the MCP server has the same
 * typed inventory the library publishes — no repo scan at runtime.
 */
export function loadManifest(): IrisManifest {
  // tsup replaces `import.meta` with an empty object in CJS output. Select the
  // native CommonJS filename there, while ESM keeps the module URL.
  const require = createRequire(currentModuleLocation())
  const path = require.resolve('@iris-ui-kit/manifest/manifest.json')
  return JSON.parse(readFileSync(path, 'utf8')) as IrisManifest
}

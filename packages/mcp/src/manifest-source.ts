import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import type { IrisManifest } from '@iris-ui-kit/manifest'

/**
 * Load the generated manifest that ships inside `@iris-ui-kit/manifest`. Resolving
 * the JSON via `require.resolve` works both in the monorepo (workspace symlink)
 * and when this package is installed standalone, so the MCP server has the same
 * typed inventory the library publishes — no repo scan at runtime.
 */
export function loadManifest(): IrisManifest {
  const require = createRequire(import.meta.url)
  const path = require.resolve('@iris-ui-kit/manifest/manifest.json')
  return JSON.parse(readFileSync(path, 'utf8')) as IrisManifest
}

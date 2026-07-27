import { fileURLToPath } from 'node:url'
import { solidPlugin } from 'esbuild-plugin-solid'
import type { Options } from 'tsup'

// babel-plugin-jsx-dom-expressions imports DOM helpers from this module name.
// Redirecting it to the shared lazy runtime keeps compiled Solid packages
// importable in plain Node/SSR while preserving the normal browser helpers.
const DOM_RUNTIME_ALIAS = '@iris-ui-kit/solid-web-runtime'
const DOM_RUNTIME_SHIM = fileURLToPath(
  new URL('../packages/solid/src/internal/lazyTemplate.ts', import.meta.url),
)

type SolidSsrBuildOptions = Pick<Options, 'esbuildPlugins' | 'esbuildOptions'>

/**
 * Shared build-only Solid transform for the main adapter and every plugin.
 * A fresh plugin instance is returned because tsup may execute configs in
 * parallel.
 */
export function solidSsrSafeBuild(): SolidSsrBuildOptions {
  return {
    esbuildPlugins: [solidPlugin({ solid: { moduleName: DOM_RUNTIME_ALIAS } })],
    esbuildOptions(options) {
      options.alias = {
        ...options.alias,
        [DOM_RUNTIME_ALIAS]: DOM_RUNTIME_SHIM,
      }
    },
  }
}

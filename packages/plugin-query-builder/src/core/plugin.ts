import { createPlugin } from '@iris-ui-kit/core'

/** CSS custom properties the query builder reads; overridable by the host theme. */
export const queryBuilderTokens: Record<string, string> = {
  '--iris-query-builder-gap': 'var(--iris-gap-md)',
}

/** Theme-token registration for `IrisProvider`. */
export const queryBuilderPlugin = createPlugin({
  name: 'query-builder',
  install(registry) {
    registry.registerTokens(queryBuilderTokens)
  },
})

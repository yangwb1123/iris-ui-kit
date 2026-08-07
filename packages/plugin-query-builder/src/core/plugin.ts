import { createPlugin } from '@iris-ui-kit/core'

/**
 * CSS custom properties the query builder reads; overridable by the host theme.
 * Empty until the render layer consumes tokens (§6c — no dead registrations).
 */
export const queryBuilderTokens: Record<string, string> = {}

/** Theme-token registration for `IrisProvider`. */
export const queryBuilderPlugin = createPlugin({
  name: 'query-builder',
  install(registry) {
    registry.registerTokens(queryBuilderTokens)
  },
})

import { createPlugin } from '@iris-ui-kit/core'
import { proTableTokens } from './view'

/**
 * The ProTable plugin. Pass to `<IrisProvider plugins={[proTablePlugin]}>`.
 * Registers renderer theme tokens; table state remains per instance.
 */
export const proTablePlugin = createPlugin({
  name: 'pro-table',
  install(registry) {
    registry.registerTokens(proTableTokens)
  },
})

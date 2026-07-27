import noInternalImportRule from './rules/no-internal-import.js'
import useIrisProviderRule from './rules/use-iris-provider.js'
import pluginNeedsRegistrationRule from './rules/plugin-needs-registration.js'

export const plugin = {
  meta: { name: '@iris-ui-kit/eslint-plugin', version: '0.1.0' },
  rules: {
    'no-internal-import': noInternalImportRule,
    'use-iris-provider': useIrisProviderRule,
    'plugin-needs-registration': pluginNeedsRegistrationRule,
  },
  get configs() {
    return {
      recommended: {
        plugins: { '@iris-ui-kit': plugin },
        rules: {
          '@iris-ui-kit/no-internal-import': 'error' as const,
          '@iris-ui-kit/use-iris-provider': 'warn' as const,
          '@iris-ui-kit/plugin-needs-registration': 'warn' as const,
        },
      },
    }
  },
}

export default plugin

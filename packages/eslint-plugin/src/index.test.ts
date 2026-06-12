import { RuleTester } from 'eslint'
import { describe, it, expect } from 'vitest'
import noInternalImport from './rules/no-internal-import.js'
import useIrisProvider from './rules/use-iris-provider.js'
import pluginNeedsRegistration from './rules/plugin-needs-registration.js'
import plugin from './index.js'

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
})

// ──────────────────────────────────────────────────────────────────
// no-internal-import
// ──────────────────────────────────────────────────────────────────
describe('no-internal-import', () => {
  it('passes valid cases and reports invalid cases', () => {
    tester.run('no-internal-import', noInternalImport, {
      valid: [
        // Public entry points are fine
        { code: "import { IrisButton } from '@iris-ui/react'" },
        { code: "import { IrisButton } from '@iris-ui/vue'" },
        { code: "import { IrisButton } from '@iris-ui/solid'" },
        // Plugin packages are fine
        { code: "import { IrisProTable } from '@iris-ui/plugin-pro-table'" },
        // Unrelated packages are fine
        { code: "import React from 'react'" },
        // Partial match that is not a src path
        { code: "import { x } from '@iris-ui/react/dist/index'" },
      ],
      invalid: [
        // React internal src path
        {
          code: "import { Button } from '@iris-ui/react/src/primitives/button/Button'",
          errors: [{ messageId: 'noInternalImport' }],
        },
        // Vue internal src path
        {
          code: "import { IrisButton } from '@iris-ui/vue/src/components/button'",
          errors: [{ messageId: 'noInternalImport' }],
        },
        // Solid internal src path
        {
          code: "import { IrisDialog } from '@iris-ui/solid/src/overlay/dialog'",
          errors: [{ messageId: 'noInternalImport' }],
        },
        // Svelte internal src path
        {
          code: "import IrisMenu from '@iris-ui/svelte/src/navigation/menu'",
          errors: [{ messageId: 'noInternalImport' }],
        },
        // Dynamic import of internal path
        {
          code: "import('@iris-ui/react/src/primitives/button/Button')",
          errors: [{ messageId: 'noInternalImport' }],
        },
      ],
    })
  })
})

// ──────────────────────────────────────────────────────────────────
// use-iris-provider
// ──────────────────────────────────────────────────────────────────
describe('use-iris-provider', () => {
  it('passes valid cases and reports invalid cases', () => {
    tester.run('use-iris-provider', useIrisProvider, {
      valid: [
        // Imports IrisProvider — no warning
        {
          code: "import { IrisButton, IrisProvider } from '@iris-ui/react'",
        },
        // Also imports IrisProvider alongside other components
        {
          code: `
            import { IrisProvider, IrisButton, IrisDialog } from '@iris-ui/vue'
          `,
        },
        // File that only imports from non-framework packages — no warning
        {
          code: "import { proTablePlugin } from '@iris-ui/plugin-pro-table'",
        },
        // No Iris imports at all
        {
          code: "import React from 'react'",
        },
      ],
      invalid: [
        // React package imported but no IrisProvider
        {
          code: "import { IrisButton } from '@iris-ui/react'",
          errors: [{ messageId: 'missingIrisProvider' }],
        },
        // Vue package — no IrisProvider
        {
          code: "import { IrisInput } from '@iris-ui/vue'",
          errors: [{ messageId: 'missingIrisProvider' }],
        },
        // Solid package — no IrisProvider
        {
          code: "import { IrisDialog } from '@iris-ui/solid'",
          errors: [{ messageId: 'missingIrisProvider' }],
        },
        // Multiple framework imports but IrisProvider still missing
        {
          code: `
            import { IrisButton } from '@iris-ui/react'
            import { IrisDialog } from '@iris-ui/react'
          `,
          errors: [{ messageId: 'missingIrisProvider' }],
        },
      ],
    })
  })
})

// ──────────────────────────────────────────────────────────────────
// plugin-needs-registration
// ──────────────────────────────────────────────────────────────────
describe('plugin-needs-registration', () => {
  it('passes valid cases and reports invalid cases', () => {
    tester.run('plugin-needs-registration', pluginNeedsRegistration, {
      valid: [
        // IrisCodeEditor with its plugin imported
        {
          code: `
            import { IrisCodeEditor, codeMirrorPlugin } from '@iris-ui/plugin-editor'
          `,
        },
        // IrisProTable with proTablePlugin imported
        {
          code: `
            import { IrisProTable, proTablePlugin } from '@iris-ui/plugin-pro-table'
          `,
        },
        // IrisFormBuilder with formBuilderPlugin imported
        {
          code: `
            import { IrisFormBuilder, formBuilderPlugin } from '@iris-ui/plugin-form-builder'
          `,
        },
        // Plugin component not imported — no warning
        {
          code: "import { IrisButton } from '@iris-ui/react'",
        },
        // All three plugin components with all three plugins registered
        {
          code: `
            import { IrisCodeEditor, codeMirrorPlugin } from '@iris-ui/plugin-editor'
            import { IrisProTable, proTablePlugin } from '@iris-ui/plugin-pro-table'
            import { IrisFormBuilder, formBuilderPlugin } from '@iris-ui/plugin-form-builder'
          `,
        },
      ],
      invalid: [
        // IrisCodeEditor without codeMirrorPlugin
        {
          code: "import { IrisCodeEditor } from '@iris-ui/plugin-editor'",
          errors: [{ messageId: 'missingPluginRegistration' }],
        },
        // IrisProTable without proTablePlugin
        {
          code: "import { IrisProTable } from '@iris-ui/plugin-pro-table'",
          errors: [{ messageId: 'missingPluginRegistration' }],
        },
        // IrisFormBuilder without formBuilderPlugin
        {
          code: "import { IrisFormBuilder } from '@iris-ui/plugin-form-builder'",
          errors: [{ messageId: 'missingPluginRegistration' }],
        },
        // Two plugin components, both missing their plugins
        {
          code: `
            import { IrisCodeEditor } from '@iris-ui/plugin-editor'
            import { IrisProTable } from '@iris-ui/plugin-pro-table'
          `,
          errors: [
            { messageId: 'missingPluginRegistration' },
            { messageId: 'missingPluginRegistration' },
          ],
        },
      ],
    })
  })
})

// ──────────────────────────────────────────────────────────────────
// Plugin shape
// ──────────────────────────────────────────────────────────────────
describe('plugin export', () => {
  it('has correct meta', () => {
    expect(plugin.meta.name).toBe('@iris-ui/eslint-plugin')
    expect(plugin.meta.version).toBe('0.1.0')
  })

  it('exposes all three rules', () => {
    expect(plugin.rules['no-internal-import']).toBeDefined()
    expect(plugin.rules['use-iris-provider']).toBeDefined()
    expect(plugin.rules['plugin-needs-registration']).toBeDefined()
  })

  it('exposes recommended config with correct severities', () => {
    const cfg = plugin.configs.recommended
    expect(cfg.rules['@iris-ui/no-internal-import']).toBe('error')
    expect(cfg.rules['@iris-ui/use-iris-provider']).toBe('warn')
    expect(cfg.rules['@iris-ui/plugin-needs-registration']).toBe('warn')
  })
})

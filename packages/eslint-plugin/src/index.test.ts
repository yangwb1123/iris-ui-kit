import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { RuleTester } from 'eslint'
import { describe, it, expect } from 'vitest'
import noInternalImport from './rules/no-internal-import.js'
import useIrisProvider from './rules/use-iris-provider.js'
import pluginNeedsRegistration, {
  EXPECTED_PLUGIN_PACKAGE_COUNT,
  KNOWN_PLUGIN_FACTORIES,
} from './rules/plugin-needs-registration.js'
import noLegacyTone from './rules/no-legacy-tone.js'
import plugin from './index.js'

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
}) as unknown as RuleTester

// JSX-aware tester for component attribute rules
const jsxTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
} as never)

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
        // IrisCodeEditor with its canonical plugin (editorPlugin) imported
        {
          code: `
            import { IrisCodeEditor, editorPlugin } from '@iris-ui/plugin-editor'
          `,
        },
        // Back-compat: the legacy alias codeMirrorPlugin still satisfies it
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
        // Newly-recognized plugins, each with its factory registered
        {
          code: "import { IrisAdminApp, adminPlugin } from '@iris-ui/plugin-admin'",
        },
        {
          code: "import { IrisEventCalendar, calendarPlugin } from '@iris-ui/plugin-calendar'",
        },
        {
          code: "import { IrisLineChart, chartsPlugin } from '@iris-ui/plugin-charts'",
        },
        // A different charts component is covered by the same chartsPlugin
        {
          code: "import { IrisSparkline, chartsPlugin } from '@iris-ui/plugin-charts'",
        },
        {
          code: "import { IrisDashboard, dashboardPlugin } from '@iris-ui/plugin-dashboard'",
        },
        {
          code: "import { IrisKanban, kanbanPlugin } from '@iris-ui/plugin-kanban'",
        },
        {
          code: "import { IrisMarkdown, markdownPlugin } from '@iris-ui/plugin-markdown'",
        },
        {
          code: "import { IrisNotificationCenter, notificationsPlugin } from '@iris-ui/plugin-notifications'",
        },
        {
          code: "import { IrisQueryBuilder, queryBuilderPlugin } from '@iris-ui/plugin-query-builder'",
        },
        // Plugin component not imported — no warning
        {
          code: "import { IrisButton } from '@iris-ui/react'",
        },
        // All three original plugin components with all three plugins registered
        {
          code: `
            import { IrisCodeEditor, editorPlugin } from '@iris-ui/plugin-editor'
            import { IrisProTable, proTablePlugin } from '@iris-ui/plugin-pro-table'
            import { IrisFormBuilder, formBuilderPlugin } from '@iris-ui/plugin-form-builder'
          `,
        },
      ],
      invalid: [
        // IrisCodeEditor without its plugin — message names the canonical factory
        {
          code: "import { IrisCodeEditor } from '@iris-ui/plugin-editor'",
          errors: [
            {
              messageId: 'missingPluginRegistration',
              data: { component: 'IrisCodeEditor', plugin: 'editorPlugin' },
            },
          ],
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
        // Newly-recognized plugins now flagged when their factory is missing
        {
          code: "import { IrisDashboard } from '@iris-ui/plugin-dashboard'",
          errors: [
            {
              messageId: 'missingPluginRegistration',
              data: { component: 'IrisDashboard', plugin: 'dashboardPlugin' },
            },
          ],
        },
        {
          code: "import { IrisKanban } from '@iris-ui/plugin-kanban'",
          errors: [{ messageId: 'missingPluginRegistration' }],
        },
        {
          code: "import { IrisNotificationCenter } from '@iris-ui/plugin-notifications'",
          errors: [{ messageId: 'missingPluginRegistration' }],
        },
        {
          code: "import { IrisQueryBuilder } from '@iris-ui/plugin-query-builder'",
          errors: [{ messageId: 'missingPluginRegistration' }],
        },
        // A charts component without chartsPlugin
        {
          code: "import { IrisBarChart } from '@iris-ui/plugin-charts'",
          errors: [
            {
              messageId: 'missingPluginRegistration',
              data: { component: 'IrisBarChart', plugin: 'chartsPlugin' },
            },
          ],
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
// plugin-needs-registration — source-of-truth completeness
// ──────────────────────────────────────────────────────────────────
describe('plugin-needs-registration source-of-truth', () => {
  // Resolve packages/plugin-* relative to this test file:
  // <repo>/packages/eslint-plugin/src/index.test.ts → <repo>/packages
  const packagesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../')
  const firstPartyPlugins = readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('plugin-'))
    .map((d) => `@iris-ui/${d.name}`)
    .sort()

  it('expects the same number of plugins that actually exist on disk', () => {
    // Guards against the on-disk plugin set drifting from the rule's constant.
    expect(firstPartyPlugins.length).toBe(EXPECTED_PLUGIN_PACKAGE_COUNT)
  })

  it('recognizes a plugin factory for every component-bearing plugin', () => {
    // locale-zh is component-less, so it has no factory in the registration
    // rule; every other on-disk plugin must contribute exactly one factory.
    const componentBearing = firstPartyPlugins.filter((p) => p !== '@iris-ui/plugin-locale-zh')
    expect(KNOWN_PLUGIN_FACTORIES.length).toBe(componentBearing.length)
    expect(KNOWN_PLUGIN_FACTORIES.length).toBe(EXPECTED_PLUGIN_PACKAGE_COUNT - 1)
  })

  it('recognizes all 12 expected plugin factories by name (not truncated)', () => {
    const expected = [
      'adminPlugin',
      'calendarPlugin',
      'chartsPlugin',
      'dashboardPlugin',
      'editorPlugin',
      'formBuilderPlugin',
      'kanbanPlugin',
      'markdownPlugin',
      'notificationsPlugin',
      'proTablePlugin',
      'queryBuilderPlugin',
    ]
    for (const factory of expected) {
      expect(KNOWN_PLUGIN_FACTORIES).toContain(factory)
    }
    expect(new Set(KNOWN_PLUGIN_FACTORIES).size).toBe(KNOWN_PLUGIN_FACTORIES.length)
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
    expect(cfg.rules['@iris-ui/no-legacy-tone']).toBe('warn')
  })
})

// ──────────────────────────────────────────────────────────────────
// no-legacy-tone
// ──────────────────────────────────────────────────────────────────
describe('no-legacy-tone', () => {
  it('passes valid cases and reports invalid cases', () => {
    jsxTester.run('no-legacy-tone', noLegacyTone, {
      valid: [
        { code: '<IrisBadge tone="danger" />' },
        { code: '<IrisBadge tone="success" />' },
        { code: '<IrisBadge tone="warning" />' },
      ],
      invalid: [
        {
          code: '<IrisBadge tone="error" />',
          errors: [{ messageId: 'legacyTone' }],
        },
        {
          code: '<IrisAlert tone="error">Something went wrong</IrisAlert>',
          errors: [{ messageId: 'legacyTone' }],
        },
      ],
    })
  })
})

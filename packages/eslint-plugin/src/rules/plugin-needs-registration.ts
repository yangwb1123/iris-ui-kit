import type { Rule } from 'eslint'

/**
 * ──────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH — first-party Iris UI plugins
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Each entry maps a plugin package to (a) the component(s) it ships and
 * (b) the plugin factory that MUST be registered in `<IrisProvider plugins=…>`
 * for those components to work.
 *
 * ESLint rules must stay static and deterministic — they may NOT scan the
 * filesystem at lint time. So this list is a hand-maintained constant rather
 * than a runtime directory scan.
 *
 * HOW TO KEEP IN SYNC (do this whenever a plugin is added/renamed):
 *   1. Every package under `packages/plugin-*` that exports an `IrisXxx`
 *      component AND a `xxxPlugin` factory belongs here.
 *   2. `pkg` is the bare public specifier (e.g. `@iris-ui/plugin-pro-table`).
 *   3. `plugin` is the canonical factory export name (e.g. `proTablePlugin`).
 *   4. `components` lists every `IrisXxx` component the package ships.
 *   5. `pluginAliases` (optional) keeps historically-recognized names passing
 *      so broadening the list never newly-flags previously-passing code.
 *
 * NOTE: `@iris-ui/plugin-locale-zh` is intentionally absent — it is a
 * locale-only plugin (`localeZhPlugin`) and ships no component, so there is
 * nothing for this "component needs its plugin" rule to anchor on.
 *
 * The `EXPECTED_PLUGIN_PACKAGE_COUNT` constant below is asserted by the unit
 * tests so the list can never be silently truncated as plugins are added.
 */
interface PluginPackage {
  /** Bare public specifier of the plugin package. */
  pkg: string
  /** Canonical plugin-factory export that must be registered in IrisProvider. */
  plugin: string
  /** Every `IrisXxx` component the package ships. */
  components: string[]
  /**
   * Legacy / alternative names that also satisfy the registration check.
   * Keeps previously-passing code passing when the canonical name changes.
   */
  pluginAliases?: string[]
}

/**
 * All first-party Iris UI plugins that ship a component requiring registration.
 * 11 of the 12 `packages/plugin-*` packages (locale-zh is component-less, see
 * note above). Keep alphabetised by package for easy auditing.
 */
const PLUGIN_PACKAGES: PluginPackage[] = [
  {
    pkg: '@iris-ui/plugin-admin',
    plugin: 'adminPlugin',
    components: ['IrisAdminApp'],
  },
  {
    pkg: '@iris-ui/plugin-calendar',
    plugin: 'calendarPlugin',
    components: ['IrisEventCalendar'],
  },
  {
    pkg: '@iris-ui/plugin-charts',
    plugin: 'chartsPlugin',
    components: ['IrisLineChart', 'IrisBarChart', 'IrisSparkline'],
  },
  {
    pkg: '@iris-ui/plugin-dashboard',
    plugin: 'dashboardPlugin',
    components: ['IrisDashboard'],
  },
  {
    pkg: '@iris-ui/plugin-editor',
    plugin: 'editorPlugin',
    components: ['IrisCodeEditor'],
    // `codeMirrorPlugin` was the name recognized by earlier versions of this
    // rule; the package actually exports `editorPlugin`. Accept both.
    pluginAliases: ['codeMirrorPlugin'],
  },
  {
    pkg: '@iris-ui/plugin-form-builder',
    plugin: 'formBuilderPlugin',
    components: ['IrisFormBuilder'],
  },
  {
    pkg: '@iris-ui/plugin-kanban',
    plugin: 'kanbanPlugin',
    components: ['IrisKanban'],
  },
  {
    pkg: '@iris-ui/plugin-markdown',
    plugin: 'markdownPlugin',
    components: ['IrisMarkdown'],
  },
  {
    pkg: '@iris-ui/plugin-notifications',
    plugin: 'notificationsPlugin',
    components: ['IrisNotificationCenter'],
  },
  {
    pkg: '@iris-ui/plugin-pro-table',
    plugin: 'proTablePlugin',
    components: ['IrisProTable'],
  },
  {
    pkg: '@iris-ui/plugin-query-builder',
    plugin: 'queryBuilderPlugin',
    components: ['IrisQueryBuilder'],
  },
]

/**
 * Total number of `packages/plugin-*` packages, including the component-less
 * `plugin-locale-zh`. Asserted by the unit tests against the real directory
 * count so the list is caught the moment it drifts. Update when a plugin is
 * genuinely added/removed.
 */
export const EXPECTED_PLUGIN_PACKAGE_COUNT = 12

/** Flat per-component entries derived from the source-of-truth table above. */
interface ComponentEntry {
  componentName: string
  componentPkg: string
  /** Canonical factory name, shown in the error message. */
  pluginName: string
  /** Set of names that satisfy the check (canonical + aliases). */
  acceptedPlugins: Set<string>
}

const PLUGIN_ENTRIES: ComponentEntry[] = PLUGIN_PACKAGES.flatMap((p) =>
  p.components.map((componentName) => ({
    componentName,
    componentPkg: p.pkg,
    pluginName: p.plugin,
    acceptedPlugins: new Set([p.plugin, ...(p.pluginAliases ?? [])]),
  })),
)

/** Exposed for tests — the canonical factory name of every plugin package. */
export const KNOWN_PLUGIN_FACTORIES = PLUGIN_PACKAGES.map((p) => p.plugin)

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Warn when a plugin component is used without its corresponding plugin being imported for registration in IrisProvider.',
      recommended: true,
      url: 'https://github.com/iris-ui/iris-ui/blob/main/packages/eslint-plugin/README.md#plugin-needs-registration',
    },
    messages: {
      missingPluginRegistration:
        "'{{component}}' requires {{plugin}} to be imported and registered in the IrisProvider plugins prop.",
    },
    schema: [],
  },

  create(context) {
    /** Track which components and plugins are imported in this file */
    const importedComponents = new Set<string>()
    const importedPlugins = new Set<string>()
    /** Map component name → the import node for accurate error location */
    const componentNodes = new Map<string, Rule.Node>()

    return {
      ImportDeclaration(node) {
        const src = node.source.value as string

        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') continue
          if (spec.imported.type !== 'Identifier') continue
          const name = spec.imported.name

          // Check if this is a plugin component import
          for (const entry of PLUGIN_ENTRIES) {
            if (name === entry.componentName && src === entry.componentPkg) {
              importedComponents.add(entry.componentName)
              componentNodes.set(entry.componentName, node as unknown as Rule.Node)
            }
            // Check if this is the corresponding plugin factory import.
            // Allow importing from the plugin package or any @iris-ui/* package.
            if (entry.acceptedPlugins.has(name)) {
              importedPlugins.add(name)
            }
          }
        }
      },

      'Program:exit'() {
        for (const entry of PLUGIN_ENTRIES) {
          if (!importedComponents.has(entry.componentName)) continue
          // Satisfied if the canonical factory OR any accepted alias is imported.
          const registered = [...entry.acceptedPlugins].some((p) => importedPlugins.has(p))
          if (registered) continue

          const node = componentNodes.get(entry.componentName)
          if (node) {
            context.report({
              node,
              messageId: 'missingPluginRegistration',
              data: {
                component: entry.componentName,
                plugin: entry.pluginName,
              },
            })
          }
        }
      },
    }
  },
}

export default rule

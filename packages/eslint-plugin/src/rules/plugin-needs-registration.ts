import type { Rule } from 'eslint'

interface PluginEntry {
  /** Named export that triggers the check (the component) */
  componentName: string
  /** The package that exports the component */
  componentPkg: string
  /** Named export that must also be imported (the plugin factory) */
  pluginName: string
  /** Human-readable plugin name for the error message */
  pluginLabel: string
}

const PLUGIN_ENTRIES: PluginEntry[] = [
  {
    componentName: 'IrisCodeEditor',
    componentPkg: '@iris-ui/plugin-editor',
    pluginName: 'codeMirrorPlugin',
    pluginLabel: 'codeMirrorPlugin',
  },
  {
    componentName: 'IrisProTable',
    componentPkg: '@iris-ui/plugin-pro-table',
    pluginName: 'proTablePlugin',
    pluginLabel: 'proTablePlugin',
  },
  {
    componentName: 'IrisFormBuilder',
    componentPkg: '@iris-ui/plugin-form-builder',
    pluginName: 'formBuilderPlugin',
    pluginLabel: 'formBuilderPlugin',
  },
]

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
            // Check if this is the corresponding plugin factory import
            // Allow importing from the plugin package or any @iris-ui/* package
            if (name === entry.pluginName) {
              importedPlugins.add(entry.pluginName)
            }
          }
        }
      },

      'Program:exit'() {
        for (const entry of PLUGIN_ENTRIES) {
          if (
            importedComponents.has(entry.componentName) &&
            !importedPlugins.has(entry.pluginName)
          ) {
            const node = componentNodes.get(entry.componentName)
            if (node) {
              context.report({
                node,
                messageId: 'missingPluginRegistration',
                data: {
                  component: entry.componentName,
                  plugin: entry.pluginLabel,
                },
              })
            }
          }
        }
      },
    }
  },
}

export default rule

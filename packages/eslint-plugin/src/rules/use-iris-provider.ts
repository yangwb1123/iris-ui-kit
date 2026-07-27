import type { Rule } from 'eslint'

/** Any @iris-ui-kit framework adapter (not plugins) */
const IRIS_FRAMEWORK_RE = /^@iris-ui-kit\/(react|vue|solid|svelte)(\/|$)/

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Warn when a file imports from an Iris UI framework package but does not import IrisProvider. Wrap your app with IrisProvider for theming and plugin support.',
      recommended: true,
      url: 'https://github.com/iris-ui/iris-ui/blob/main/packages/eslint-plugin/README.md#use-iris-provider',
    },
    messages: {
      missingIrisProvider:
        "Wrap your app with IrisProvider for theming and plugin support. Import IrisProvider from '@iris-ui-kit/{{pkg}}'.",
    },
    schema: [],
  },

  create(context) {
    let hasFrameworkImport = false
    let hasIrisProvider = false
    let frameworkPkg = 'react'
    /** The first framework import node — used as the report location */
    let firstImportNode: Rule.Node | null = null

    return {
      ImportDeclaration(node) {
        const src = node.source.value as string

        if (IRIS_FRAMEWORK_RE.test(src)) {
          if (!hasFrameworkImport) {
            hasFrameworkImport = true
            firstImportNode = node as unknown as Rule.Node
            const match = src.match(IRIS_FRAMEWORK_RE)
            if (match?.[1]) frameworkPkg = match[1]
          }

          // Check whether any specifier is IrisProvider
          for (const spec of node.specifiers) {
            if (
              spec.type === 'ImportSpecifier' &&
              spec.imported.type === 'Identifier' &&
              spec.imported.name === 'IrisProvider'
            ) {
              hasIrisProvider = true
            }
          }
        }
      },

      'Program:exit'() {
        if (hasFrameworkImport && !hasIrisProvider && firstImportNode) {
          context.report({
            node: firstImportNode,
            messageId: 'missingIrisProvider',
            data: { pkg: frameworkPkg },
          })
        }
      },
    }
  },
}

export default rule

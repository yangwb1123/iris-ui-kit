import type { Rule } from 'eslint'

const INTERNAL_PATH_RE = /^@iris-ui-kit\/(react|vue|solid|svelte)\/src\//

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow importing from internal source paths of Iris UI packages. Use the public package entry point instead.',
      recommended: true,
      url: 'https://github.com/iris-ui/iris-ui/blob/main/packages/eslint-plugin/README.md#no-internal-import',
    },
    messages: {
      noInternalImport:
        "Do not import from '{{path}}'. Use the public package entry instead (e.g. import { ... } from '@iris-ui-kit/{{pkg}}').",
    },
    schema: [],
  },

  create(context) {
    function checkSource(node: Rule.Node, source: string) {
      if (INTERNAL_PATH_RE.test(source)) {
        const pkg = source.match(INTERNAL_PATH_RE)?.[1] ?? ''
        context.report({
          node,
          messageId: 'noInternalImport',
          data: { path: source, pkg },
        })
      }
    }

    return {
      ImportDeclaration(node) {
        checkSource(node as unknown as Rule.Node, node.source.value as string)
      },
      // Also cover dynamic import() and require()
      ImportExpression(node) {
        const src = node.source
        if (src.type === 'Literal' && typeof src.value === 'string') {
          checkSource(node as unknown as Rule.Node, src.value)
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments.length === 1
        ) {
          const arg = node.arguments[0]
          if (arg && arg.type === 'Literal' && typeof arg.value === 'string') {
            checkSource(node as unknown as Rule.Node, arg.value)
          }
        }
      },
    }
  },
}

export default rule

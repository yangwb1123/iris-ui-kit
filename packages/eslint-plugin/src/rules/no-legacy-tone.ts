import type { Rule } from 'eslint'

/**
 * ESLint rule: no-legacy-tone
 *
 * Warns when `tone="error"` is used on Iris components (Badge, Alert, Banner, etc.).
 * The tone values were unified from `'error'`/`'danger'` to `'danger'`.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use tone="danger" instead of the legacy tone="error".',
      recommended: true,
    },
    messages: {
      legacyTone:
        'Use tone="danger" instead of "error". The "error" tone has been unified into "danger".',
    },
    schema: [],
  },

  create(context) {
    return {
      JSXAttribute(rawNode: unknown) {
        const node = rawNode as {
          name?: { type?: string; name?: string }
          value?: { type?: string; value?: string }
        }
        if (
          node.name?.type === 'JSXIdentifier' &&
          node.name?.name === 'tone' &&
          node.value &&
          node.value.type === 'Literal' &&
          node.value.value === 'error'
        ) {
          context.report({
            node: rawNode as Rule.Node,
            messageId: 'legacyTone',
          })
        }
      },
    }
  },
}

export default rule

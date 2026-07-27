import { defineComponent, h, type PropType, type VNodeChild } from 'vue'
import { markdownToNodes, type MarkdownNode } from '../core'

export {
  markdownToHtml,
  markdownToNodes,
  markdownTokens,
  markdownPlugin,
  type MarkdownNode,
} from '../core'

function renderNode(node: MarkdownNode): VNodeChild {
  if (node.type === 'text') return node.value
  return h(node.tag, node.attrs, node.children.map(renderNode))
}

/**
 * Render Markdown as allowlisted Vue VNodes. Core emits structured nodes, so
 * the renderer never binds an `innerHTML` sink.
 */
export const IrisMarkdown = defineComponent({
  name: 'IrisMarkdown',
  props: {
    content: { type: String as PropType<string>, required: true },
    class: { type: String as PropType<string>, default: undefined },
  },
  setup(props) {
    return () =>
      h(
        'div',
        {
          'data-iris-markdown': '',
          class: props.class,
          style: { fontFamily: 'var(--iris-md-font)' },
        },
        markdownToNodes(props.content).map(renderNode),
      )
  },
})

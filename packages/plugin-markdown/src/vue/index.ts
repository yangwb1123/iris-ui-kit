import { defineComponent, h, type PropType } from 'vue'
import { markdownToHtml } from '../core'

export { markdownTokens, markdownPlugin } from '../core'

/**
 * Render Markdown as themed HTML (Vue, render-function authored to match the
 * `@iris-ui/vue` convention). The `content` prop is converted via
 * `markdownToHtml` and bound with `innerHTML` via Vue's `v-html` equivalent
 * in the render function. Themed via CSS custom properties.
 */
export const IrisMarkdown = defineComponent({
  name: 'IrisMarkdown',
  props: {
    content: { type: String as PropType<string>, required: true },
    class: { type: String as PropType<string>, default: undefined },
  },
  setup(props) {
    return () =>
      h('div', {
        'data-iris-markdown': '',
        class: props.class,
        style: { fontFamily: 'var(--iris-md-font)' },
        innerHTML: markdownToHtml(props.content),
      })
  },
})

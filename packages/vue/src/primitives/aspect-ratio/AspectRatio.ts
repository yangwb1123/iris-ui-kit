import { defineComponent, h } from 'vue'

/**
 * Aspect-ratio box: constrains its slot content to a fixed width/height ratio
 * (via the CSS `aspect-ratio` property), with an absolutely-filled content
 * layer — handy for images, video, and iframe embeds.
 */
export const IrisAspectRatio = defineComponent({
  name: 'IrisAspectRatio',
  inheritAttrs: false,
  props: {
    /** Width / height ratio. */
    ratio: { type: Number, default: 16 / 9 },
  },
  setup(props, { attrs, slots }) {
    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-aspect-ratio': '',
          'data-ratio': props.ratio,
          style: {
            position: 'relative',
            width: '100%',
            aspectRatio: String(props.ratio),
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h(
            'div',
            {
              'data-iris-aspect-ratio-content': '',
              style: { position: 'absolute', inset: '0', width: '100%', height: '100%' },
            },
            slots.default?.(),
          ),
        ],
      )
  },
})

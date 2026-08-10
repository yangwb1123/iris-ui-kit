import { defineComponent, h } from 'vue'

const SR_ONLY: Record<string, string> = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: 'calc(-1px)',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: '0',
}

/**
 * Visually-hidden content: present in the accessibility tree (read by screen
 * readers) but clipped from view — for labels, live-region announcements, and
 * extra context. Forwards attributes like `aria-live` / `role`.
 */
export const IrisVisuallyHidden = defineComponent({
  name: 'IrisVisuallyHidden',
  inheritAttrs: false,
  setup(_props, { attrs, slots }) {
    return () =>
      h(
        'span',
        {
          ...attrs,
          'data-iris-visually-hidden': '',
          style: { ...SR_ONLY, ...((attrs.style as Record<string, string> | undefined) ?? {}) },
        },
        slots.default?.(),
      )
  },
})

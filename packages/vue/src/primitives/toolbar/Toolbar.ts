import { defineComponent, h, onMounted, ref, type PropType } from 'vue'

export type IrisToolbarOrientation = 'horizontal' | 'vertical'

const SELECTOR = 'button, [href], input, select, textarea, [tabindex]'

/**
 * Toolbar: a `role="toolbar"` grouping of actions with roving-tabindex keyboard
 * navigation — one item is in the tab order, and Arrow keys (per orientation)
 * plus Home/End move focus and the tab stop between the focusable children.
 */
export const IrisToolbar = defineComponent({
  name: 'IrisToolbar',
  inheritAttrs: false,
  props: {
    orientation: { type: String as PropType<IrisToolbarOrientation>, default: 'horizontal' },
    ariaLabel: { type: String, default: undefined },
  },
  setup(props, { attrs, slots }) {
    const root = ref<HTMLElement | null>(null)

    const items = (): HTMLElement[] => {
      if (!root.value) return []
      return (Array.from(root.value.querySelectorAll(SELECTOR)) as HTMLElement[]).filter(
        (el) => !el.hasAttribute('disabled'),
      )
    }

    onMounted(() => {
      items().forEach((el, i) => {
        el.tabIndex = i === 0 ? 0 : -1
      })
    })

    const onKeyDown = (e: KeyboardEvent) => {
      const nextKey = props.orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
      const prevKey = props.orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
      const list = items()
      if (list.length === 0) return
      const cur = list.indexOf(document.activeElement as HTMLElement)
      let target: number
      if (e.key === nextKey) target = ((cur < 0 ? 0 : cur) + 1) % list.length
      else if (e.key === prevKey) target = ((cur < 0 ? 0 : cur) - 1 + list.length) % list.length
      else if (e.key === 'Home') target = 0
      else if (e.key === 'End') target = list.length - 1
      else return
      e.preventDefault()
      list.forEach((el, i) => {
        el.tabIndex = i === target ? 0 : -1
      })
      list[target]?.focus()
    }

    return () =>
      h(
        'div',
        {
          ...attrs,
          ref: root,
          role: 'toolbar',
          'aria-orientation': props.orientation,
          'aria-label': props.ariaLabel,
          'data-iris-toolbar': '',
          'data-orientation': props.orientation,
          onKeydown: onKeyDown,
          style: {
            display: 'inline-flex',
            flexDirection: props.orientation === 'vertical' ? 'column' : 'row',
            alignItems: 'center',
            gap: '4px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
  },
})

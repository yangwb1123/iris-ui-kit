import { defineComponent, h, inject } from 'vue'
import { TabsContextKey } from './context'

/** Container for `IrisTabsTrigger`s. Renders `<div role="tablist">`. */
export const IrisTabsList = defineComponent({
  name: 'IrisTabsList',
  inheritAttrs: false,
  setup(_, { slots, attrs }) {
    const ctx = inject(TabsContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisTabsList must be inside an IrisTabs')
    }
    return () =>
      h(
        'div',
        {
          ...attrs,
          ref: (el: unknown) => {
            ctx.listRef.value = (el ?? null) as HTMLElement | null
          },
          role: 'tablist',
          'aria-orientation': ctx.orientation.value,
          'data-iris-tabs-list': '',
          'data-orientation': ctx.orientation.value,
          style: {
            display: 'flex',
            flexDirection: ctx.orientation.value === 'horizontal' ? 'row' : 'column',
            gap: '2px',
            borderBottom:
              ctx.orientation.value === 'horizontal' ? '1px solid var(--iris-border)' : 'none',
            borderInlineEnd:
              ctx.orientation.value === 'vertical' ? '1px solid var(--iris-border)' : 'none',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
  },
})

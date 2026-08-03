import { defineComponent, h, inject } from 'vue'
import { TabsContextKey } from './context'
import { installTabsStyles } from './styles'

/** Container for `IrisTabsTrigger`s. Renders `<div role="tablist">`. */
export const IrisTabsList = defineComponent({
  name: 'IrisTabsList',
  inheritAttrs: false,
  setup(_, { slots, attrs }) {
    installTabsStyles()
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
          class: ['iris-tabs-list', attrs.class],
          style: attrs.style,
        },
        slots.default?.(),
      )
  },
})

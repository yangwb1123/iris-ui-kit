import { computed, defineComponent, h, inject } from 'vue'
import { TabsContextKey } from './context'

/**
 * Panel paired with a `IrisTabsTrigger` by matching `value`. When `lazy` is
 * true on the parent (default), inactive panels are unmounted so their
 * setup hooks run only when first shown. Pass `:force-mount="true"` to
 * always render (useful for SEO or pre-warming).
 */
export const IrisTabsContent = defineComponent({
  name: 'IrisTabsContent',
  inheritAttrs: false,
  props: {
    value: { type: String, required: true },
    /** Render even when inactive; hidden via `hidden` attribute. */
    forceMount: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(TabsContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisTabsContent must be inside an IrisTabs')
    }

    const isActive = computed(() => ctx.value.value === props.value)

    return () => {
      if (!isActive.value && ctx.lazy.value && !props.forceMount) return null
      return h(
        'div',
        {
          ...attrs,
          role: 'tabpanel',
          id: `iris-tabs-content-${props.value}`,
          'aria-labelledby': `iris-tabs-trigger-${props.value}`,
          'data-iris-tabs-content': '',
          'data-state': isActive.value ? 'active' : 'inactive',
          hidden: !isActive.value || undefined,
          tabindex: 0,
          style: {
            padding: 'var(--iris-padding-md) 0',
            outline: 'none',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
    }
  },
})

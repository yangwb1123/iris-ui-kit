import { computed, defineComponent, provide, ref, type PropType } from 'vue'
import { nextEnabledIndex } from '@iris-ui/core'
import { TabsContextKey, type IrisTabsOrientation } from './context'

interface TriggerRegistration {
  value: string
  isDisabled: () => boolean
}

/**
 * Tabs root. Provides context for value, orientation, lazy mounting, and the
 * ordered set of registered triggers so arrow-key navigation can move focus
 * deterministically (skipping disabled triggers).
 *
 * @example
 *   <IrisTabs default-value="profile">
 *     <IrisTabsList>
 *       <IrisTabsTrigger value="profile">Profile</IrisTabsTrigger>
 *       <IrisTabsTrigger value="prefs">Preferences</IrisTabsTrigger>
 *     </IrisTabsList>
 *     <IrisTabsContent value="profile">...</IrisTabsContent>
 *     <IrisTabsContent value="prefs">...</IrisTabsContent>
 *   </IrisTabs>
 */
export const IrisTabs = defineComponent({
  name: 'IrisTabs',
  props: {
    /** Controlled active value. Combine with `@update:value` or `v-model:value`. */
    value: { type: String, default: undefined },
    /** Initial active value for uncontrolled mode. */
    defaultValue: { type: String, default: undefined },
    orientation: { type: String as PropType<IrisTabsOrientation>, default: 'horizontal' },
    disabled: { type: Boolean, default: false },
    /** When true, content panels are unmounted when not active. Default `true`. */
    lazy: { type: Boolean, default: true },
  },
  emits: {
    'update:value': (_value: string) => true,
  },
  setup(props, { slots, emit }) {
    const isControlled = computed(() => props.value !== undefined)
    const internalValue = ref<string | null>(props.defaultValue ?? null)

    const effectiveValue = computed<string | null>(() =>
      isControlled.value ? (props.value as string) : internalValue.value,
    )

    const setValue = (next: string) => {
      if (!isControlled.value) internalValue.value = next
      emit('update:value', next)
    }

    // Ordered trigger registry — preserves render order so arrow nav is intuitive.
    const triggers = ref<TriggerRegistration[]>([])
    const listRef = ref<HTMLElement | null>(null)

    const registerTrigger = (value: string, isDisabled: () => boolean) => {
      if (triggers.value.some((t) => t.value === value)) return
      triggers.value = [...triggers.value, { value, isDisabled }]
      // First registered trigger becomes the default focus target if no value set.
      if (internalValue.value === null && !isControlled.value && !isDisabled()) {
        internalValue.value = value
      }
    }

    const unregisterTrigger = (value: string) => {
      triggers.value = triggers.value.filter((t) => t.value !== value)
    }

    const focusTriggerByValue = (value: string) => {
      const root = listRef.value
      if (!root) return
      const el = root.querySelector<HTMLElement>(`[data-iris-tabs-trigger][data-value="${value}"]`)
      el?.focus()
    }

    const moveFocus = (from: string, delta: 1 | -1 | 'home' | 'end') => {
      const enabled = triggers.value.filter((t) => !t.isDisabled())
      if (enabled.length === 0) return
      const fromIndex = enabled.findIndex((t) => t.value === from)
      let nextIndex: number
      if (delta === 'home') nextIndex = 0
      else if (delta === 'end') nextIndex = enabled.length - 1
      else nextIndex = nextEnabledIndex(fromIndex, delta, enabled.length)
      const next = enabled[nextIndex]
      if (next) {
        setValue(next.value)
        focusTriggerByValue(next.value)
      }
    }

    provide(TabsContextKey, {
      value: effectiveValue,
      setValue,
      orientation: computed(() => props.orientation),
      disabled: computed(() => props.disabled),
      lazy: computed(() => props.lazy),
      registerTrigger,
      unregisterTrigger,
      moveFocus,
      listRef,
    })

    return () => slots.default?.()
  },
})

import {
  computed,
  defineComponent,
  h,
  provide,
  ref,
  useId,
  watch,
  type PropType,
  type Ref,
} from 'vue'
import { createKeyboardNav, type KeyboardNavAction } from '@iris-ui/core'
import { useStore } from '../../useStore'
import { AccordionContextKey } from './context'

export type IrisAccordionValue = string | string[] | null

/**
 * Container for collapsible sections.
 *
 *   - `multiple=false` (default): zero or one item open at a time. The
 *     `modelValue` is `string | null`. Set `collapsible=true` to allow
 *     closing the currently-open item.
 *   - `multiple=true`: any number of items open. `modelValue` is `string[]`.
 *
 * Each child `IrisAccordionItem` registers itself by `value` and self-renders
 * its header (button) + content (region).
 */
export const IrisAccordion = defineComponent({
  name: 'IrisAccordion',
  inheritAttrs: false,
  props: {
    /** Either a string (single mode) or string[] (multiple mode). */
    modelValue: {
      type: null as unknown as PropType<IrisAccordionValue>,
      default: undefined,
    },
    /** Uncontrolled initial value. */
    defaultValue: {
      type: null as unknown as PropType<IrisAccordionValue>,
      default: undefined,
    },
    multiple: { type: Boolean, default: false },
    /** In single mode, allow zero items open. */
    collapsible: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_value: IrisAccordionValue) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const isControlled = computed(() => props.modelValue !== undefined)

    const initialInternal: IrisAccordionValue =
      props.defaultValue !== undefined ? props.defaultValue : props.multiple ? [] : null

    const internal = ref<IrisAccordionValue>(initialInternal)

    watch(
      () => props.modelValue,
      (value) => {
        if (value === undefined) return
        internal.value = value
      },
    )

    const current = computed<IrisAccordionValue>(() =>
      isControlled.value ? (props.modelValue as IrisAccordionValue) : internal.value,
    )

    const isOpen = (value: string): boolean => {
      const c = current.value
      if (c === null || c === undefined) return false
      if (Array.isArray(c)) return c.includes(value)
      return c === value
    }

    const setValue = (next: IrisAccordionValue) => {
      if (!isControlled.value) internal.value = next
      emit('update:modelValue', next)
    }

    const toggle = (value: string) => {
      if (props.multiple) {
        const arr = Array.isArray(current.value) ? current.value : []
        const idx = arr.indexOf(value)
        const next = idx >= 0 ? arr.filter((v) => v !== value) : [...arr, value]
        setValue(next)
        return
      }
      if (current.value === value) {
        if (props.collapsible) setValue(null)
      } else {
        setValue(value)
      }
    }

    // ── Keyboard navigation (single-sourced in core controller) ──────────
    interface RegisteredItem {
      value: string
      el: Ref<HTMLButtonElement | null>
    }
    const items: RegisteredItem[] = []

    const nav = createKeyboardNav({
      count: items.length,
      loop: true,
      orientation: 'vertical',
    })

    const activeIndex = useStore(nav.store)

    const registerItem = (value: string, el: Ref<HTMLButtonElement | null>): (() => void) => {
      if (!items.find((it) => it.value === value)) {
        items.push({ value, el })
        nav.reset(items.length)
      }
      return () => {
        const idx = items.findIndex((it) => it.value === value)
        if (idx >= 0) {
          items.splice(idx, 1)
          nav.reset(items.length)
        }
      }
    }

    const focusItem = (value: string) => {
      const idx = items.findIndex((it) => it.value === value)
      if (idx >= 0) nav.focus(idx)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const action: KeyboardNavAction = nav.handleKeyDown({
        key: event.key,
        preventDefault: () => event.preventDefault(),
      })
      if (action.type === 'focus') {
        items[action.target]?.el.value?.focus()
      }
    }

    provide(AccordionContextKey, {
      isOpen,
      toggle,
      rootId: useId(),
      collapsible: computed(() => props.collapsible),
      multiple: computed(() => props.multiple),
      activeIndex,
      registerItem,
      focusItem,
    })

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-accordion': '',
          'data-iris-accordion-multiple': props.multiple ? 'true' : undefined,
          onKeydown: handleKeyDown,
        },
        slots.default?.(),
      )
  },
})

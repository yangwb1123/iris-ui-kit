import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  provide,
  shallowRef,
  watch,
  type PropType,
  type Ref,
} from 'vue'
import { createSelectionModel } from '@iris-ui-kit/core'
import {
  ToggleGroupContextKey,
  type IrisToggleGroupType,
  type IrisToggleGroupOrientation,
  type IrisToggleGroupVariant,
} from './context'

/**
 * Segmented control. Two modes:
 *
 *   - `type="single"` — radio-like; `modelValue` is `string | null`. Root
 *     gets `role="radiogroup"`, items get `role="radio"` + `aria-checked`.
 *   - `type="multiple"` — toggle-like; `modelValue` is `string[]`. Root
 *     gets `role="group"`, items get `aria-pressed`.
 *
 * Keyboard: arrow keys move focus among items (roving tabindex); Space /
 * Enter activates.
 */
export const IrisToggleGroup = defineComponent({
  name: 'IrisToggleGroup',
  inheritAttrs: false,
  props: {
    type: { type: String as PropType<IrisToggleGroupType>, default: 'single' },
    modelValue: {
      type: null as unknown as PropType<string | string[] | null>,
      default: undefined,
    },
    orientation: { type: String as PropType<IrisToggleGroupOrientation>, default: 'horizontal' },
    size: { type: String as PropType<'sm' | 'md' | 'lg'>, default: 'md' },
    variant: { type: String as PropType<IrisToggleGroupVariant>, default: 'outline' },
    disabled: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_value: string | string[] | null) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const items: { value: string; el: Ref<HTMLElement | null> }[] = []

    // Selection logic (single/multiple toggle, dedup) lives in the core model;
    // this component only maps its union value shape (string | string[] | null)
    // to/from the model's flat key array. Mode is fixed at creation (mirrors the
    // React `IrisToggleGroup` reference).
    const isMultiple = props.type === 'multiple'
    const toKeys = (v: string | string[] | null | undefined): string[] =>
      v == null ? [] : Array.isArray(v) ? v : [v]
    const fromKeys = (keys: string[]): string | string[] | null =>
      isMultiple ? keys : (keys[0] ?? null)

    const isControlled = computed(() => props.modelValue !== undefined)
    const model = createSelectionModel<string>({
      mode: isMultiple ? 'multiple' : 'single',
      defaultSelected: toKeys(props.modelValue),
      onChange: (keys) => emit('update:modelValue', fromKeys(keys)),
    })
    const selected = shallowRef<string[]>(model.get())
    onBeforeUnmount(
      model.store.subscribe((keys) => {
        selected.value = keys
      }),
    )

    // Controlled (v-model): mirror the prop into the model without re-emitting.
    watch(
      () => props.modelValue,
      (v) => model.sync(toKeys(v)),
    )

    // Controlled groups RENDER from the prop (true controlled semantics): a press
    // emits update:modelValue but the active items only change when the parent
    // writes `modelValue` back; uncontrolled renders from the model store.
    const displaySelected = computed<string[]>(() =>
      isControlled.value ? toKeys(props.modelValue) : selected.value,
    )

    const isActive = (value: string): boolean => displaySelected.value.includes(value)

    const toggle = (value: string) => {
      if (props.disabled) return
      // Re-base on the prop so the emitted next value is computed against what the
      // parent holds (not a prior, possibly-rejected, optimistic value).
      if (isControlled.value) model.sync(toKeys(props.modelValue))
      model.toggle(value)
    }

    const registerItem = (value: string, el: Ref<HTMLElement | null>) => {
      if (!items.find((it) => it.value === value)) items.push({ value, el })
    }

    const unregisterItem = (value: string) => {
      const idx = items.findIndex((it) => it.value === value)
      if (idx >= 0) items.splice(idx, 1)
    }

    const moveFocus = (from: string, delta: 1 | -1 | 'home' | 'end') => {
      if (items.length === 0) return
      const idx = items.findIndex((it) => it.value === from)
      let next: number
      if (delta === 'home') next = 0
      else if (delta === 'end') next = items.length - 1
      else next = (idx + delta + items.length) % items.length
      items[next]?.el.value?.focus()
    }

    provide(ToggleGroupContextKey, {
      type: computed(() => props.type),
      orientation: computed(() => props.orientation),
      size: computed(() => props.size),
      variant: computed(() => props.variant),
      disabled: computed(() => props.disabled),
      isActive,
      toggle,
      registerItem,
      unregisterItem,
      moveFocus,
    })

    return () =>
      h(
        'div',
        {
          ...attrs,
          role: props.type === 'single' ? 'radiogroup' : 'group',
          'aria-orientation': props.orientation,
          'aria-disabled': props.disabled ? 'true' : undefined,
          'data-iris-toggle-group': '',
          'data-iris-toggle-group-type': props.type,
          'data-iris-toggle-group-orientation': props.orientation,
          'data-iris-toggle-group-size': props.size,
          style: {
            display: 'inline-flex',
            flexDirection: props.orientation === 'horizontal' ? 'row' : 'column',
            borderRadius: 'var(--iris-radius-md, 6px)',
            overflow: 'hidden',
            background: props.variant === 'outline' ? 'transparent' : 'var(--iris-surface)',
            border:
              props.variant === 'outline'
                ? '1px solid var(--iris-border)'
                : '1px solid transparent',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
  },
})

/** Re-export the item from a separate file. */
export { IrisToggleGroupItem } from './ToggleGroupItem'

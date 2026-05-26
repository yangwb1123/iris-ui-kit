import { computed, defineComponent, h, provide, ref, watch, type PropType } from 'vue'
import { StepperContextKey, type IrisStepperOrientation } from './context'

/**
 * Multi-step flow container. Children should be `IrisStepperStep`s; each
 * registers itself with the stepper's context and self-renders its
 * indicator + title.
 *
 * Modes:
 *   - `linear=true` (default) — clicking a future step is blocked. Use
 *     this for wizards where order matters (signup, upload, checkout).
 *   - `linear=false` — any step is clickable. Use for navigation-style
 *     steppers (settings sections, page anchors).
 */
export const IrisStepper = defineComponent({
  name: 'IrisStepper',
  inheritAttrs: false,
  props: {
    modelValue: { type: Number, default: 0 },
    orientation: { type: String as PropType<IrisStepperOrientation>, default: 'horizontal' },
    linear: { type: Boolean, default: true },
  },
  emits: {
    'update:modelValue': (_value: number) => true,
    change: (_value: number) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const stepCount = ref(0)
    // Map from step index → "alive" — we recycle indexes when steps unmount,
    // but in practice the rendered tree is static enough that the simple
    // monotonic counter works.

    const current = computed(() => Math.max(0, Math.min(stepCount.value - 1, props.modelValue)))
    const total = computed(() => stepCount.value)

    const computeStatus = (index: number) => {
      if (index < current.value) return 'completed' as const
      if (index === current.value) return 'active' as const
      return 'pending' as const
    }

    const registerStep = (): number => {
      const idx = stepCount.value
      stepCount.value += 1
      return idx
    }

    const unregisterStep = () => {
      // No-op — indices are stable; we just won't render the removed step.
      // If you need to support truly dynamic step lists, revisit this.
    }

    const goTo = (index: number) => {
      if (index < 0 || index >= total.value) return
      if (props.linear && index > current.value) return
      if (index === current.value) return
      emit('update:modelValue', index)
      emit('change', index)
    }

    // Clamp the controlled value when steps unmount (e.g. dynamic flows).
    watch(stepCount, (count) => {
      if (props.modelValue > count - 1 && count > 0) {
        emit('update:modelValue', count - 1)
      }
    })

    provide(StepperContextKey, {
      current,
      orientation: computed(() => props.orientation),
      linear: computed(() => props.linear),
      registerStep,
      unregisterStep,
      total,
      goTo,
      computeStatus,
    })

    return () =>
      h(
        'ol',
        {
          ...attrs,
          'data-iris-stepper': '',
          'data-iris-stepper-orientation': props.orientation,
          role: 'list',
          style: {
            display: 'flex',
            flexDirection: props.orientation === 'horizontal' ? 'row' : 'column',
            gap: '0',
            margin: '0',
            padding: '0',
            listStyle: 'none',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
  },
})

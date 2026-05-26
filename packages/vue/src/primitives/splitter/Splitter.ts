import { computed, defineComponent, h, ref, type PropType } from 'vue'
import { useDrag } from '../drag/useDrag'

export type IrisSplitterOrientation = 'horizontal' | 'vertical'

/**
 * Two-pane splitter with a draggable divider. Children supplied via slots
 * `start` and `end`. The split position is a number in `[0, 1]` and can be
 * controlled via `v-model`.
 *
 * Orientation:
 *   - `horizontal` (default) — divider is a vertical bar; panes are side-by-side.
 *   - `vertical` — divider is a horizontal bar; panes are stacked.
 *
 * Clamping respects `minStart` / `minEnd` (in px) so panes don't collapse
 * below a usable size.
 */
export const IrisSplitter = defineComponent({
  name: 'IrisSplitter',
  inheritAttrs: false,
  props: {
    orientation: {
      type: String as PropType<IrisSplitterOrientation>,
      default: 'horizontal',
    },
    /** Split ratio in `[0, 1]`. */
    modelValue: { type: Number, default: 0.5 },
    /** Minimum size of the start pane in px. */
    minStart: { type: Number, default: 80 },
    /** Minimum size of the end pane in px. */
    minEnd: { type: Number, default: 80 },
    /** Disable dragging. */
    disabled: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_value: number) => true,
  },
  setup(props, { slots, attrs, emit }) {
    const containerRef = ref<HTMLElement | null>(null)
    const handleRef = ref<HTMLElement | null>(null)
    const dragging = ref(false)

    const isHorizontal = computed(() => props.orientation === 'horizontal')

    let startRatio = 0
    let totalSize = 0

    useDrag({
      handle: handleRef,
      disabled: computed(() => props.disabled),
      onStart: () => {
        const container = containerRef.value
        if (!container) return false
        const rect = container.getBoundingClientRect()
        totalSize = isHorizontal.value ? rect.width : rect.height
        if (totalSize <= 0) return false
        startRatio = props.modelValue
        dragging.value = true
        return true
      },
      onDrag: ({ dx, dy }) => {
        if (totalSize <= 0) return
        const delta = isHorizontal.value ? dx : dy
        const nextRatio = startRatio + delta / totalSize
        const minStartRatio = props.minStart / totalSize
        const maxRatio = 1 - props.minEnd / totalSize
        const clamped = Math.max(minStartRatio, Math.min(maxRatio, nextRatio))
        emit('update:modelValue', clamped)
      },
      onEnd: () => {
        dragging.value = false
      },
    })

    const containerStyle = computed<Record<string, string>>(() => ({
      display: 'flex',
      flexDirection: isHorizontal.value ? 'row' : 'column',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      ...((attrs.style as Record<string, string> | undefined) ?? {}),
    }))

    const startStyle = computed<Record<string, string>>(() => ({
      flex: `${props.modelValue} 1 0`,
      minWidth: '0',
      minHeight: '0',
      overflow: 'auto',
    }))

    const endStyle = computed<Record<string, string>>(() => ({
      flex: `${1 - props.modelValue} 1 0`,
      minWidth: '0',
      minHeight: '0',
      overflow: 'auto',
    }))

    const handleStyle = computed<Record<string, string>>(() => ({
      flex: '0 0 4px',
      background: dragging.value ? 'var(--iris-primary)' : 'var(--iris-border)',
      cursor: props.disabled
        ? 'not-allowed'
        : isHorizontal.value
          ? 'col-resize'
          : 'row-resize',
      transition: 'background-color 120ms ease',
      position: 'relative',
      touchAction: 'none',
    }))

    return () =>
      h(
        'div',
        {
          ...attrs,
          ref: (el: unknown) => {
            containerRef.value = (el ?? null) as HTMLElement | null
          },
          'data-iris-splitter': '',
          'data-iris-splitter-orientation': props.orientation,
          'data-state': dragging.value ? 'dragging' : 'idle',
          style: containerStyle.value,
        },
        [
          h(
            'div',
            { 'data-iris-splitter-pane': 'start', style: startStyle.value },
            slots.start?.(),
          ),
          h('div', {
            ref: (el: unknown) => {
              handleRef.value = (el ?? null) as HTMLElement | null
            },
            'data-iris-splitter-handle': '',
            role: 'separator',
            'aria-orientation': props.orientation,
            'aria-valuenow': Math.round(props.modelValue * 100),
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            tabindex: props.disabled ? -1 : 0,
            style: handleStyle.value,
          }),
          h(
            'div',
            { 'data-iris-splitter-pane': 'end', style: endStyle.value },
            slots.end?.(),
          ),
        ],
      )
  },
})

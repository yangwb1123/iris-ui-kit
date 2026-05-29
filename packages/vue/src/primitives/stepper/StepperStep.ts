import { computed, defineComponent, h, inject, onBeforeMount, ref, type PropType } from 'vue'
import { StepperContextKey, type IrisStepStatus } from './context'

const STATUS_COLOR: Record<IrisStepStatus, string> = {
  pending: 'var(--iris-muted)',
  active: 'var(--iris-primary)',
  completed: 'var(--iris-success)',
  error: 'var(--iris-danger)',
}

/**
 * A single step in an {@link IrisStepper}. Auto-numbers based on its
 * position in the document order (registers on mount). Override `status`
 * to force a specific visual (most common case: `error` for a step the
 * user just failed validation on).
 *
 * Click forwards through `IrisStepper`'s `goTo` (which gates by `linear`).
 */
export const IrisStepperStep = defineComponent({
  name: 'IrisStepperStep',
  inheritAttrs: false,
  props: {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    /** Force a status; otherwise computed from position vs. current. */
    status: { type: String as PropType<IrisStepStatus>, default: undefined },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(StepperContextKey)
    if (!ctx) throw new Error('IrisStepperStep must be used inside <IrisStepper>')

    const index = ref<number>(-1)
    onBeforeMount(() => {
      index.value = ctx.registerStep()
    })

    const status = computed<IrisStepStatus>(() => props.status ?? ctx.computeStatus(index.value))

    const onClick = () => {
      if (props.disabled) return
      ctx.goTo(index.value)
    }

    return () => {
      const isHorizontal = ctx.orientation.value === 'horizontal'
      const s = status.value
      const color = STATUS_COLOR[s]
      const isLast = index.value === ctx.total.value - 1

      const indicator = h(
        'span',
        {
          'data-iris-stepper-indicator': '',
          'data-iris-stepper-status': s,
          'aria-hidden': 'true',
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            minWidth: '28px',
            borderRadius: '50%',
            background: s === 'completed' ? color : 'var(--iris-background)',
            color: s === 'completed' ? 'var(--iris-primary-foreground, #fff)' : color,
            border: `2px solid ${color}`,
            fontSize: '13px',
            fontWeight: '600',
            lineHeight: '1',
            transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease',
          },
        },
        s === 'completed' ? '✓' : s === 'error' ? '!' : String(index.value + 1),
      )

      const titleNode =
        props.title || slots.title
          ? h(
              'div',
              {
                'data-iris-stepper-title': '',
                style: {
                  fontSize: '13px',
                  fontWeight: s === 'active' ? '600' : '500',
                  color: s === 'pending' ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                },
              },
              slots.title?.() ?? props.title,
            )
          : null

      const descNode =
        props.description || slots.description
          ? h(
              'div',
              {
                'data-iris-stepper-description': '',
                style: { fontSize: '12px', color: 'var(--iris-muted)' },
              },
              slots.description?.() ?? props.description,
            )
          : null

      const connector = !isLast
        ? h('span', {
            'data-iris-stepper-connector': '',
            'aria-hidden': 'true',
            style: isHorizontal
              ? {
                  flex: '1',
                  height: '1px',
                  background:
                    index.value < ctx.current.value ? STATUS_COLOR.completed : 'var(--iris-border)',
                  margin: '0 8px',
                  alignSelf: 'center',
                }
              : {
                  width: '1px',
                  minHeight: '24px',
                  background:
                    index.value < ctx.current.value ? STATUS_COLOR.completed : 'var(--iris-border)',
                  marginInlineStart: '13px',
                  marginTop: '4px',
                  marginBottom: '4px',
                },
          })
        : null

      const clickable = !props.disabled && (!ctx.linear.value || index.value <= ctx.current.value)

      return h(
        'li',
        {
          ...attrs,
          'data-iris-stepper-step': '',
          'data-iris-stepper-step-status': s,
          'data-iris-stepper-step-disabled': props.disabled ? 'true' : undefined,
          'aria-current': s === 'active' ? 'step' : undefined,
          style: isHorizontal
            ? {
                display: 'flex',
                alignItems: 'flex-start',
                flex: isLast ? '0 0 auto' : '1 1 0',
                gap: '8px',
                minWidth: '0',
                ...((attrs.style as Record<string, string> | undefined) ?? {}),
              }
            : {
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                ...((attrs.style as Record<string, string> | undefined) ?? {}),
              },
        },
        isHorizontal
          ? [
              h(
                'button',
                {
                  type: 'button',
                  disabled: !clickable || undefined,
                  'data-iris-stepper-step-trigger': '',
                  onClick,
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'transparent',
                    border: 'none',
                    padding: '0',
                    cursor: clickable ? 'pointer' : 'default',
                    color: 'inherit',
                    font: 'inherit',
                    textAlign: 'start',
                  },
                },
                [indicator, h('div', null, [titleNode, descNode])],
              ),
              connector,
            ]
          : [
              h(
                'button',
                {
                  type: 'button',
                  disabled: !clickable || undefined,
                  'data-iris-stepper-step-trigger': '',
                  onClick,
                  style: {
                    display: 'inline-flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    background: 'transparent',
                    border: 'none',
                    padding: '0',
                    cursor: clickable ? 'pointer' : 'default',
                    color: 'inherit',
                    font: 'inherit',
                    textAlign: 'start',
                  },
                },
                [indicator, h('div', null, [titleNode, descNode])],
              ),
              connector,
            ],
      )
    }
  },
})

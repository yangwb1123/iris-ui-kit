import * as React from 'react'
import { useStepperContext, type IrisStepStatus } from './context'

const STATUS_COLOR: Record<IrisStepStatus, string> = {
  pending: 'var(--iris-muted)',
  active: 'var(--iris-primary)',
  completed: 'var(--iris-success)',
  error: 'var(--iris-danger)',
}

export interface IrisStepperStepProps
  extends Omit<React.HTMLAttributes<HTMLLIElement>, 'title'> {
  title?: React.ReactNode
  description?: React.ReactNode
  /** Force a status; otherwise computed from position vs current. */
  status?: IrisStepStatus
  disabled?: boolean
}

/**
 * A single step in an {@link IrisStepper}. Auto-numbers based on its position
 * in the document order (registers on mount). Click forwards through `goTo`
 * which gates by `linear`.
 */
export const IrisStepperStep = React.forwardRef<HTMLLIElement, IrisStepperStepProps>(
  function IrisStepperStep({ title, description, status, disabled = false, style, ...rest }, ref) {
    const ctx = useStepperContext('IrisStepperStep')
    const [index, setIndex] = React.useState(-1)

    const register = ctx.registerStep
    React.useEffect(() => {
      const { index: i, unregister } = register()
      setIndex(i)
      return unregister
    }, [register])

    const effectiveStatus: IrisStepStatus =
      status ?? (index >= 0 ? ctx.computeStatus(index) : 'pending')

    const onClick = () => {
      if (disabled || index < 0) return
      ctx.goTo(index)
    }

    const isHorizontal = ctx.orientation === 'horizontal'
    const s = effectiveStatus
    const color = STATUS_COLOR[s]
    const isLast = index === ctx.total - 1
    const clickable = !disabled && (!ctx.linear || index <= ctx.current)

    const indicator = (
      <span
        data-iris-stepper-indicator=""
        data-iris-stepper-status={s}
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          minWidth: 28,
          borderRadius: '50%',
          background: s === 'completed' ? color : 'var(--iris-background)',
          color: s === 'completed' ? 'var(--iris-primary-foreground, #fff)' : color,
          border: `2px solid ${color}`,
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1,
          transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease',
        }}
      >
        {s === 'completed' ? '✓' : s === 'error' ? '!' : String(index + 1)}
      </span>
    )

    const titleNode = title ? (
      <div
        data-iris-stepper-title=""
        style={{
          fontSize: 13,
          fontWeight: s === 'active' ? 600 : 500,
          color: s === 'pending' ? 'var(--iris-muted)' : 'var(--iris-foreground)',
        }}
      >
        {title}
      </div>
    ) : null

    const descNode = description ? (
      <div
        data-iris-stepper-description=""
        style={{ fontSize: 12, color: 'var(--iris-muted)' }}
      >
        {description}
      </div>
    ) : null

    const connector = !isLast ? (
      <span
        data-iris-stepper-connector=""
        aria-hidden="true"
        style={
          isHorizontal
            ? {
                flex: 1,
                height: 1,
                background:
                  index < ctx.current ? STATUS_COLOR.completed : 'var(--iris-border)',
                margin: '0 8px',
                alignSelf: 'center',
              }
            : {
                width: 1,
                minHeight: 24,
                background:
                  index < ctx.current ? STATUS_COLOR.completed : 'var(--iris-border)',
                marginLeft: 13,
                marginTop: 4,
                marginBottom: 4,
              }
        }
      />
    ) : null

    return (
      <li
        {...rest}
        ref={ref}
        data-iris-stepper-step=""
        data-iris-stepper-step-status={s}
        data-iris-stepper-step-disabled={disabled ? 'true' : undefined}
        aria-current={s === 'active' ? 'step' : undefined}
        style={
          isHorizontal
            ? {
                display: 'flex',
                alignItems: 'flex-start',
                flex: isLast ? '0 0 auto' : '1 1 0',
                gap: 8,
                minWidth: 0,
                ...style,
              }
            : {
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                ...style,
              }
        }
      >
        <button
          type="button"
          disabled={!clickable || undefined}
          data-iris-stepper-step-trigger=""
          onClick={onClick}
          style={{
            display: 'inline-flex',
            alignItems: isHorizontal ? 'center' : 'flex-start',
            gap: 8,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: clickable ? 'pointer' : 'default',
            color: 'inherit',
            font: 'inherit',
            textAlign: 'left',
          }}
        >
          {indicator}
          <div>
            {titleNode}
            {descNode}
          </div>
        </button>
        {connector}
      </li>
    )
  },
)

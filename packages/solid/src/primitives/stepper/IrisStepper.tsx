import { createSignal, mergeProps, onMount, splitProps, type JSX } from 'solid-js'
import {
  StepperCtx,
  useStepperContext,
  type IrisStepperOrientation,
  type IrisStepStatus,
} from './context'

// ── Stepper Container ──────────────────────────────────────────────────────

export interface IrisStepperProps {
  value?: number
  defaultValue?: number
  orientation?: IrisStepperOrientation
  linear?: boolean
  onChange?: (value: number) => void
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
}

export function IrisStepper(props: IrisStepperProps): JSX.Element {
  const merged = mergeProps(
    { orientation: 'horizontal' as IrisStepperOrientation, linear: true, defaultValue: 0 },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'value',
    'defaultValue',
    'orientation',
    'linear',
    'onChange',
    'children',
  ])

  const isControlled = (): boolean => local.value !== undefined
  const [internal, setInternal] = createSignal(local.defaultValue ?? 0)
  const [stepCount, setStepCount] = createSignal(0)

  const current = (): number => {
    const raw = isControlled() ? (local.value as number) : internal()
    return Math.max(0, Math.min(stepCount() > 0 ? stepCount() - 1 : 0, raw))
  }

  const computeStatus = (index: number): IrisStepStatus => {
    if (index < current()) return 'completed'
    if (index === current()) return 'active'
    return 'pending'
  }

  const registerStep = (): number => {
    const idx = stepCount()
    setStepCount((c) => c + 1)
    return idx
  }

  const goTo = (index: number): void => {
    if (index < 0 || index >= stepCount()) return
    if (local.linear && index > current()) return
    if (index === current()) return
    if (!isControlled()) setInternal(index)
    local.onChange?.(index)
  }

  return (
    <StepperCtx.Provider
      value={{
        current,
        get orientation() {
          return () => local.orientation
        },
        get linear() {
          return () => local.linear
        },
        registerStep,
        unregisterStep: () => undefined,
        total: stepCount,
        goTo,
        computeStatus,
      }}
    >
      <ol
        {...rest}
        data-iris-stepper=""
        data-iris-stepper-orientation={local.orientation}
        role="list"
        style={{
          display: 'flex',
          'flex-direction': local.orientation === 'horizontal' ? 'row' : 'column',
          gap: '0',
          margin: '0',
          padding: '0',
          'list-style': 'none',
          ...((rest.style as JSX.CSSProperties) ?? {}),
        }}
      >
        {local.children}
      </ol>
    </StepperCtx.Provider>
  )
}

// ── Stepper Step ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<IrisStepStatus, string> = {
  pending: 'var(--iris-muted)',
  active: 'var(--iris-primary)',
  completed: 'var(--iris-success, #10b981)',
  error: 'var(--iris-danger)',
}

export interface IrisStepperStepProps {
  title?: string
  description?: string
  status?: IrisStepStatus
  disabled?: boolean
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
}

export function IrisStepperStep(props: IrisStepperStepProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'title',
    'description',
    'status',
    'disabled',
    'children',
  ])
  const ctx = useStepperContext()

  const [index, setIndex] = createSignal(-1)
  onMount(() => {
    setIndex(ctx.registerStep())
  })

  const status = (): IrisStepStatus => local.status ?? ctx.computeStatus(index())
  const isHorizontal = (): boolean => ctx.orientation() === 'horizontal'
  const isLast = (): boolean => index() === ctx.total() - 1
  const s = (): IrisStepStatus => status()
  const color = (): string => STATUS_COLOR[s()]
  const clickable = (): boolean => !local.disabled && (!ctx.linear() || index() <= ctx.current())

  const onClick = (): void => {
    if (local.disabled) return
    ctx.goTo(index())
  }

  const indicator = (): JSX.Element => (
    <span
      data-iris-stepper-indicator=""
      data-iris-stepper-status={s()}
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        'justify-content': 'center',
        width: '28px',
        height: '28px',
        'min-width': '28px',
        'border-radius': '50%',
        background: s() === 'completed' ? color() : 'var(--iris-background)',
        color: s() === 'completed' ? 'var(--iris-primary-foreground, #fff)' : color(),
        border: `2px solid ${color()}`,
        'font-size': 'var(--iris-font-size-sm, 13px)',
        'font-weight': '600',
        'line-height': '1',
        transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease',
      }}
    >
      {s() === 'completed' ? '✓' : s() === 'error' ? '!' : String(index() + 1)}
    </span>
  )

  const connector = (): JSX.Element | null => {
    if (isLast()) return null
    return (
      <span
        data-iris-stepper-connector=""
        aria-hidden="true"
        style={
          isHorizontal()
            ? {
                flex: '1',
                height: '1px',
                background: index() < ctx.current() ? STATUS_COLOR.completed : 'var(--iris-border)',
                margin: '0 8px',
                'align-self': 'center',
              }
            : {
                width: '1px',
                'min-height': '24px',
                background: index() < ctx.current() ? STATUS_COLOR.completed : 'var(--iris-border)',
                'margin-inline-start': '13px',
                'margin-top': '4px',
                'margin-bottom': '4px',
              }
        }
      />
    )
  }

  const labelContent = (): JSX.Element => (
    <>
      {indicator()}
      <div>
        {local.title && (
          <div
            data-iris-stepper-title=""
            style={{
              'font-size': 'var(--iris-font-size-sm, 13px)',
              'font-weight': s() === 'active' ? '600' : '500',
              color: s() === 'pending' ? 'var(--iris-muted)' : 'var(--iris-foreground)',
            }}
          >
            {local.title}
          </div>
        )}
        {local.description && (
          <div
            data-iris-stepper-description=""
            style={{ 'font-size': 'var(--iris-font-size-xs, 12px)', color: 'var(--iris-muted)' }}
          >
            {local.description}
          </div>
        )}
      </div>
    </>
  )

  return (
    <li
      {...rest}
      data-iris-stepper-step=""
      data-iris-stepper-step-status={s()}
      data-iris-stepper-step-disabled={local.disabled ? 'true' : undefined}
      aria-current={s() === 'active' ? 'step' : undefined}
      style={{
        display: 'flex',
        'flex-direction': isHorizontal() ? 'row' : 'column',
        'align-items': isHorizontal() ? 'flex-start' : undefined,
        flex: isHorizontal() && !isLast() ? '1 1 0' : isHorizontal() ? '0 0 auto' : undefined,
        gap: isHorizontal() ? '8px' : '4px',
        'min-width': isHorizontal() ? '0' : undefined,
        ...((rest.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <button
        type="button"
        disabled={!clickable()}
        data-iris-stepper-step-trigger=""
        onClick={onClick}
        style={{
          display: 'inline-flex',
          'align-items': isHorizontal() ? 'center' : 'flex-start',
          gap: '8px',
          background: 'transparent',
          border: 'none',
          padding: '0',
          cursor: clickable() ? 'pointer' : 'default',
          color: 'inherit',
          font: 'inherit',
          'text-align': 'start',
        }}
      >
        {labelContent()}
      </button>
      {connector()}
    </li>
  )
}

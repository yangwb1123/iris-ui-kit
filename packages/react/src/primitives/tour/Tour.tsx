import * as React from 'react'
import { useI18n } from '../../i18n'

export interface IrisTourStep {
  /** Element to spotlight for this step. */
  target?: () => HTMLElement | null
  title?: React.ReactNode
  description?: React.ReactNode
}

export interface IrisTourProps {
  steps: IrisTourStep[]
  open?: boolean
  defaultOpen?: boolean
  onChange?: (index: number) => void
  onClose?: () => void
  onFinish?: () => void
  style?: React.CSSProperties
  className?: string
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const btnBase: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 'var(--iris-font-size-sm, 13px)',
  borderRadius: 'var(--iris-radius-sm, 4px)',
  cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  ...btnBase,
  border: '1px solid var(--iris-border)',
  background: 'transparent',
  color: 'var(--iris-foreground)',
}
const btnPrimary: React.CSSProperties = {
  ...btnBase,
  border: 'none',
  background: 'var(--iris-primary)',
  color: 'var(--iris-primary-foreground, #fff)',
}

/**
 * Guided tour: an overlay that walks the user through `steps`, spotlighting an
 * optional target per step and showing a dialog card with prev/next/skip
 * controls. Controlled (`open`) or uncontrolled (`defaultOpen`); the step index
 * is managed internally and resets each time the tour opens.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisTour}.
 */
export function IrisTour({
  steps,
  open,
  defaultOpen = false,
  onChange,
  onClose,
  onFinish,
  style,
  className,
  ...rest
}: IrisTourProps): React.ReactElement | null {
  const { t } = useI18n()
  const isControlled = open !== undefined
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const isOpen = isControlled ? (open as boolean) : internalOpen
  const [step, setStep] = React.useState(0)
  const [spotlight, setSpotlight] = React.useState<Rect | null>(null)
  const wasOpen = React.useRef(false)

  const total = steps.length
  const current = Math.min(step, Math.max(0, total - 1))
  const stepData = steps[current]

  React.useEffect(() => {
    if (isOpen && !wasOpen.current) setStep(0)
    wasOpen.current = isOpen
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen || !stepData) return
    const el = stepData.target?.()
    if (el) {
      const r = el.getBoundingClientRect()
      setSpotlight({ top: r.top, left: r.left, width: r.width, height: r.height })
    } else {
      setSpotlight(null)
    }
  }, [isOpen, current, stepData])

  const close = () => {
    if (!isControlled) setInternalOpen(false)
    onClose?.()
  }

  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen])

  if (!isOpen || total === 0 || !stepData) return null

  const isLast = current === total - 1
  const next = () => {
    if (!isLast) {
      setStep(current + 1)
      onChange?.(current + 1)
    } else {
      onFinish?.()
      close()
    }
  }
  const prev = () => {
    if (current > 0) {
      setStep(current - 1)
      onChange?.(current - 1)
    }
  }

  const spotlit = spotlight && spotlight.width > 0
  const cardPos: React.CSSProperties = spotlit
    ? { top: spotlight.top + spotlight.height + 12, insetInlineStart: spotlight.left }
    : { top: '50%', insetInlineStart: '50%', transform: 'translate(-50%, -50%)' }
  const dialogLabel =
    typeof stepData.title === 'string'
      ? stepData.title
      : t('tour.step', { current: current + 1, total })

  return (
    <div data-iris-tour="" className={className} {...rest} style={style}>
      <div
        data-iris-tour-backdrop=""
        onClick={close}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000 }}
      />
      {spotlit ? (
        <div
          data-iris-tour-spotlight=""
          style={{
            position: 'fixed',
            top: spotlight.top - 4,
            insetInlineStart: spotlight.left - 4,
            width: spotlight.width + 8,
            height: spotlight.height + 8,
            border: '2px solid var(--iris-primary)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            zIndex: 1001,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div
        data-iris-tour-card=""
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
        style={{
          position: 'fixed',
          zIndex: 1002,
          maxWidth: 320,
          padding: 16,
          background: 'var(--iris-background)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-md, 6px)',
          boxShadow: 'var(--iris-shadow-lg)',
          ...cardPos,
        }}
      >
        {stepData.title != null ? (
          <div
            data-iris-tour-title=""
            style={{ fontWeight: 600, marginBlockEnd: 'var(--iris-space-xs, 8px)' }}
          >
            {stepData.title}
          </div>
        ) : null}
        {stepData.description != null ? (
          <div
            data-iris-tour-description=""
            style={{
              fontSize: 'var(--iris-font-size-md, 14px)',
              color: 'var(--iris-foreground)',
              marginBlockEnd: 12,
            }}
          >
            {stepData.description}
          </div>
        ) : null}
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
        >
          <span
            data-iris-tour-indicator=""
            style={{ fontSize: 'var(--iris-font-size-xs, 12px)', color: 'var(--iris-muted)' }}
          >
            {t('tour.step', { current: current + 1, total })}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" data-iris-tour-skip="" onClick={close} style={btnGhost}>
              {t('tour.skip')}
            </button>
            {current > 0 ? (
              <button type="button" data-iris-tour-prev="" onClick={prev} style={btnGhost}>
                {t('tour.prev')}
              </button>
            ) : null}
            <button type="button" data-iris-tour-next="" onClick={next} style={btnPrimary}>
              {isLast ? t('tour.finish') : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

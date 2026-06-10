import {
  createEffect,
  createSignal,
  mergeProps,
  onCleanup,
  onMount,
  Show,
  untrack,
  type JSX,
} from 'solid-js'
import { Portal } from 'solid-js/web'
import { useI18n } from '../../i18n'

export interface IrisTourStep {
  target?: () => HTMLElement | null
  title?: string
  description?: string
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const btnBase: JSX.CSSProperties = {
  padding: '4px 12px',
  'font-size': '13px',
  'border-radius': 'var(--iris-radius-sm, 4px)',
  cursor: 'pointer',
}
const btnGhost: JSX.CSSProperties = {
  ...btnBase,
  border: '1px solid var(--iris-border)',
  background: 'transparent',
  color: 'var(--iris-foreground)',
}
const btnPrimary: JSX.CSSProperties = {
  ...btnBase,
  border: 'none',
  background: 'var(--iris-primary)',
  color: '#fff',
}

export interface IrisTourProps {
  steps?: IrisTourStep[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onChange?: (index: number) => void
  onClose?: () => void
  onFinish?: () => void
}

/**
 * Guided product tour. Walks the user through `steps`, spotlighting an optional
 * target per step and showing a card with prev/next/skip controls.
 * Solid port of the Vue IrisTour.
 */
export function IrisTour(props: IrisTourProps): JSX.Element {
  const merged = mergeProps({ steps: [] as IrisTourStep[], open: false }, props)

  const { t } = useI18n()

  const [step, setStep] = createSignal(0)
  const [spotlight, setSpotlight] = createSignal<Rect | null>(null)

  const computeSpotlight = (): void => {
    const data = merged.steps[step()]
    const el = data?.target?.()
    if (el) {
      const r = el.getBoundingClientRect()
      setSpotlight({ top: r.top, left: r.left, width: r.width, height: r.height })
    } else {
      setSpotlight(null)
    }
  }

  createEffect(() => {
    // Only track merged.open; use untrack so computeSpotlight's read of step()
    // does NOT make this effect re-run on every step change (which would reset
    // the step back to 0).
    if (merged.open) {
      setStep(0)
      untrack(computeSpotlight)
    }
  })

  createEffect(() => {
    // Recompute spotlight when step changes
    void step()
    computeSpotlight()
  })

  const close = (): void => {
    merged.onOpenChange?.(false)
    merged.onClose?.()
  }

  const onKey = (e: KeyboardEvent): void => {
    if (merged.open && e.key === 'Escape') close()
  }

  onMount(() => document.addEventListener('keydown', onKey))
  onCleanup(() => document.removeEventListener('keydown', onKey))

  const total = (): number => merged.steps.length

  const next = (): void => {
    const current = Math.min(step(), total() - 1)
    const isLast = current === total() - 1
    if (!isLast) {
      setStep(current + 1)
      merged.onChange?.(current + 1)
    } else {
      merged.onFinish?.()
      close()
    }
  }

  const prev = (): void => {
    const current = step()
    if (current > 0) {
      setStep(current - 1)
      merged.onChange?.(current - 1)
    }
  }

  // Use createMemo for derived values so they stay reactive
  const current = (): number => Math.min(step(), total() - 1)
  const data = (): IrisTourStep | undefined => merged.steps[current()]
  const isLast = (): boolean => current() === total() - 1
  const sl = (): Rect | null => spotlight()
  const spotlit = (): boolean => {
    const s = sl()
    return !!s && s.width > 0
  }

  const cardPos = (): JSX.CSSProperties => {
    const s = sl()
    return spotlit() && s
      ? { top: `${s.top + s.height + 12}px`, 'inset-inline-start': `${s.left}px` }
      : { top: '50%', 'inset-inline-start': '50%', transform: 'translate(-50%, -50%)' }
  }

  const dialogLabel = (): string =>
    data()?.title ?? t('tour.step', { current: current() + 1, total: total() })

  return (
    <Show when={merged.open && total() > 0}>
      <Portal>
        <div data-iris-tour="">
          {/* Backdrop */}
          <div
            data-iris-tour-backdrop=""
            onClick={close}
            style={{
              position: 'fixed',
              inset: '0',
              background: 'rgba(0,0,0,0.45)',
              'z-index': 1000,
            }}
          />
          {/* Spotlight */}
          <Show when={spotlit()}>
            <div
              data-iris-tour-spotlight=""
              style={{
                position: 'fixed',
                top: `${sl()!.top - 4}px`,
                'inset-inline-start': `${sl()!.left - 4}px`,
                width: `${sl()!.width + 8}px`,
                height: `${sl()!.height + 8}px`,
                border: '2px solid var(--iris-primary)',
                'border-radius': 'var(--iris-radius-sm, 4px)',
                'box-shadow': '0 0 0 9999px rgba(0,0,0,0.45)',
                'z-index': 1001,
                'pointer-events': 'none',
              }}
            />
          </Show>
          {/* Card */}
          <Show when={data() != null}>
            <div
              data-iris-tour-card=""
              role="dialog"
              aria-modal="true"
              aria-label={dialogLabel()}
              style={{
                position: 'fixed',
                'z-index': 1002,
                'max-width': '320px',
                padding: '16px',
                background: 'var(--iris-background)',
                border: '1px solid var(--iris-border)',
                'border-radius': 'var(--iris-radius-md, 6px)',
                'box-shadow': '0 8px 24px rgba(0,0,0,0.18)',
                ...cardPos(),
              }}
            >
              <Show when={data()?.title != null}>
                <div
                  data-iris-tour-title=""
                  style={{ 'font-weight': '600', 'margin-block-end': '6px' }}
                >
                  {data()?.title}
                </div>
              </Show>
              <Show when={data()?.description != null}>
                <div
                  data-iris-tour-description=""
                  style={{
                    'font-size': '14px',
                    color: 'var(--iris-foreground)',
                    'margin-block-end': '12px',
                  }}
                >
                  {data()?.description}
                </div>
              </Show>
              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'space-between',
                  gap: '8px',
                }}
              >
                <span
                  data-iris-tour-indicator=""
                  style={{ 'font-size': '12px', color: 'var(--iris-muted)' }}
                >
                  {current() + 1} / {total()}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" data-iris-tour-skip="" onClick={close} style={btnGhost}>
                    {t('tour.skip')}
                  </button>
                  <Show when={current() > 0}>
                    <button type="button" data-iris-tour-prev="" onClick={prev} style={btnGhost}>
                      {t('tour.prev')}
                    </button>
                  </Show>
                  <button type="button" data-iris-tour-next="" onClick={next} style={btnPrimary}>
                    {isLast() ? t('tour.finish') : t('tour.next')}
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </Portal>
    </Show>
  )
}

import { createSignal, mergeProps, Show, splitProps, type JSX } from 'solid-js'

export type IrisBannerTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

const TONE_TO_VAR: Record<IrisBannerTone, string> = {
  info: '--iris-primary',
  success: '--iris-success',
  warning: '--iris-warning',
  danger: '--iris-danger',
  neutral: '--iris-muted',
}

export interface IrisBannerProps {
  tone?: IrisBannerTone
  closable?: boolean
  open?: boolean
  sticky?: boolean
  onClose?: () => void
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
}

/**
 * Edge-to-edge announcement bar. Solid port of the Vue/React IrisBanner.
 */
export function IrisBanner(props: IrisBannerProps): JSX.Element {
  const merged = mergeProps(
    { tone: 'info' as IrisBannerTone, closable: false, sticky: false },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'tone',
    'closable',
    'open',
    'sticky',
    'onClose',
    'children',
    'style',
    'class',
  ])

  const isControlled = (): boolean => local.open !== undefined
  const [internalOpen, setInternalOpen] = createSignal(true)

  const isOpen = (): boolean => (isControlled() ? Boolean(local.open) : internalOpen())

  const onClose = (): void => {
    if (!isControlled()) setInternalOpen(false)
    local.onClose?.()
  }

  const tonalVar = (): string => `var(${TONE_TO_VAR[local.tone]})`

  return (
    <Show when={isOpen()}>
      <div
        {...rest}
        role="status"
        data-iris-banner=""
        data-iris-banner-tone={local.tone}
        class={local.class as string | undefined}
        style={{
          display: 'flex',
          'align-items': 'center',
          gap: 'var(--iris-gap-md, 12px)',
          padding: '8px var(--iris-padding-md, 16px)',
          width: '100%',
          background: `color-mix(in srgb, ${tonalVar()} 14%, var(--iris-background, #fff))`,
          color: 'var(--iris-foreground)',
          'border-bottom': `1px solid color-mix(in srgb, ${tonalVar()} 50%, transparent)`,
          ...(local.sticky ? { position: 'sticky' as const, top: '0', 'z-index': '40' } : {}),
          ...((local.style as JSX.CSSProperties) ?? {}),
        }}
      >
        <div data-iris-banner-content="" style={{ flex: '1', 'min-width': '0' }}>
          {local.children}
        </div>
        {local.closable && (
          <button
            type="button"
            data-iris-banner-close=""
            aria-label="Close"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--iris-muted)',
              'font-size': '16px',
              padding: '0 4px',
              'line-height': '1',
              'flex-shrink': '0',
            }}
          >
            ✕
          </button>
        )}
      </div>
    </Show>
  )
}

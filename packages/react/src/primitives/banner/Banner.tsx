import * as React from 'react'
import { useI18n } from '../../i18n'

export type IrisBannerTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

const TONE_TO_VAR: Record<IrisBannerTone, string> = {
  info: '--iris-primary',
  success: '--iris-success',
  warning: '--iris-warning',
  danger: '--iris-danger',
  neutral: '--iris-muted',
}

export interface IrisBannerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  tone?: IrisBannerTone
  closable?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (next: boolean) => void
  /** Use `position: sticky; top: 0;`. */
  sticky?: boolean
  /** Optional icon slot rendered before the content. */
  icon?: React.ReactNode
  /** Optional actions slot rendered after the content. */
  actions?: React.ReactNode
  children?: React.ReactNode
}

/**
 * Edge-to-edge announcement bar — typically pinned to the top of the layout.
 * Distinct from `IrisAlert`:
 *   1. Edge-to-edge (full width) instead of a contained card
 *   2. Optional `sticky` positioning
 *   3. Tighter vertical padding
 */
export function IrisBanner({
  tone = 'info',
  closable = false,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  sticky = false,
  icon,
  actions,
  style,
  children,
  ...rest
}: IrisBannerProps): React.ReactElement | null {
  const { t } = useI18n()
  const isControlled = openProp !== undefined
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const isOpen = isControlled ? Boolean(openProp) : internalOpen

  const handleClose = () => {
    if (!isControlled) setInternalOpen(false)
    onOpenChange?.(false)
  }

  if (!isOpen) return null

  const tonalVar = `var(${TONE_TO_VAR[tone]})`

  return (
    <div
      {...rest}
      role="status"
      data-iris-banner=""
      data-iris-banner-tone={tone}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--iris-gap-md, 12px)',
        padding: '8px var(--iris-padding-md, 16px)',
        width: '100%',
        // Tonal surface: `backgroundColor` is the precomputed fallback (used on
        // engines without color-mix); the `background` shorthand (later in source
        // order) overrides it with the exact color-mix on modern engines.
        backgroundColor: `var(${TONE_TO_VAR[tone]}-subtle)`,
        background: `color-mix(in srgb, ${tonalVar} 14%, var(--iris-background))`,
        color: 'var(--iris-foreground)',
        // Border: shorthand carries width/style + a solid fallback color; the
        // `borderBottomColor` longhand (later) refines it to the color-mix.
        borderBottom: `1px solid ${tonalVar}`,
        borderBottomColor: `color-mix(in srgb, ${tonalVar} 50%, transparent)`,
        ...(sticky ? { position: 'sticky', top: 0, zIndex: 40 } : {}),
        ...style,
      }}
    >
      {icon ? (
        <span
          data-iris-banner-icon=""
          style={{ color: tonalVar, display: 'inline-flex', flexShrink: 0 }}
        >
          {icon}
        </span>
      ) : null}
      <div data-iris-banner-content="" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
      {actions ? (
        <div data-iris-banner-actions="" style={{ display: 'inline-flex', gap: 8, flexShrink: 0 }}>
          {actions}
        </div>
      ) : null}
      {closable ? (
        <button
          type="button"
          data-iris-banner-close=""
          aria-label={t('banner.close')}
          onClick={handleClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--iris-muted)',
            fontSize: 16,
            padding: '0 4px',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      ) : null}
    </div>
  )
}

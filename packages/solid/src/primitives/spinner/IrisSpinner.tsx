import { mergeProps, onMount, splitProps, type JSX } from 'solid-js'
import { useI18n } from '../../i18n'

export type IrisSpinnerSize = 'sm' | 'md' | 'lg' | number

const SIZE_MAP: Record<Exclude<IrisSpinnerSize, number>, number> = {
  sm: 14,
  md: 18,
  lg: 24,
}

function resolveSize(size: IrisSpinnerSize): number {
  return typeof size === 'number' ? size : SIZE_MAP[size]
}

export const SPINNER_STYLE_ID = 'iris-spinner-styles'

const SPINNER_CSS = `
@keyframes iris-spinner-rotate {
  to { transform: rotate(360deg); }
}
[data-iris-spinner] {
  display: inline-block;
  animation: iris-spinner-rotate 0.9s linear infinite;
  vertical-align: middle;
}
[data-iris-spinner] > circle {
  fill: none;
  stroke-linecap: round;
  stroke-dasharray: 60 200;
}
@media (prefers-reduced-motion: reduce) {
  [data-iris-spinner] {
    animation: none;
  }
  [data-iris-spinner] > circle {
    stroke-dasharray: 0;
  }
}
`.trim()

let spinnerStyleInstalled = false

export function installSpinnerStyles(): void {
  if (spinnerStyleInstalled) return
  if (typeof document === 'undefined') return
  if (document.getElementById(SPINNER_STYLE_ID)) {
    spinnerStyleInstalled = true
    return
  }
  const el = document.createElement('style')
  el.id = SPINNER_STYLE_ID
  el.textContent = SPINNER_CSS
  document.head.appendChild(el)
  spinnerStyleInstalled = true
}

export function resetSpinnerStyles(): void {
  spinnerStyleInstalled = false
  if (typeof document !== 'undefined') {
    document.getElementById(SPINNER_STYLE_ID)?.remove()
  }
}

export interface IrisSpinnerProps extends Omit<JSX.HTMLAttributes<HTMLSpanElement>, 'children'> {
  size?: IrisSpinnerSize
  /** CSS color value. Defaults to the primary tone. */
  color?: string
  /** SVG stroke width in px. Auto-scaled by size when not specified. */
  strokeWidth?: number
  /** Visually-hidden screen reader label. */
  label?: string
}

const SR_ONLY: JSX.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  'white-space': 'nowrap',
  border: '0',
}

/**
 * Activity indicator. Pure SVG + a single keyframes rule injected once.
 * Honors `prefers-reduced-motion`. Accessible via `role="status"` + `aria-label`.
 */
export function IrisSpinner(props: IrisSpinnerProps): JSX.Element {
  const merged = mergeProps(
    {
      size: 'md' as IrisSpinnerSize,
      color: 'var(--iris-primary)',
      strokeWidth: 0,
    },
    props,
  )
  const [local, rest] = splitProps(merged, ['size', 'color', 'strokeWidth', 'label', 'style'])

  const { t } = useI18n()

  onMount(installSpinnerStyles)

  const px = () => resolveSize(local.size)
  const sw = () => local.strokeWidth || Math.max(1.5, Math.round(px() * 0.12))
  const label = () => local.label ?? t('spinner.loading')

  return (
    <span
      {...rest}
      role="status"
      aria-live="polite"
      data-iris-spinner-wrap=""
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <svg
        data-iris-spinner=""
        width={px()}
        height={px()}
        viewBox="0 0 50 50"
        aria-hidden="true"
        style={{ color: local.color }}
      >
        <circle cx="25" cy="25" r="20" stroke="currentColor" stroke-width={sw()} />
      </svg>
      {label() && <span style={SR_ONLY}>{label()}</span>}
    </span>
  )
}

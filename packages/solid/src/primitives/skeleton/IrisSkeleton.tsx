import { mergeProps, onMount, splitProps, type JSX } from 'solid-js'
import { useI18n } from '../../i18n'

export type IrisSkeletonShape = 'rect' | 'circle' | 'text'

export const SKELETON_STYLE_ID = 'iris-skeleton-styles'

const SKELETON_CSS = `
@keyframes iris-skeleton-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
[data-iris-skeleton] {
  display: block;
  background-color: var(--iris-surface);
  border-radius: var(--iris-radius-sm, 4px);
}
[data-iris-skeleton][data-iris-skeleton-animated="true"] {
  background-image: linear-gradient(
    90deg,
    var(--iris-surface) 0%,
    color-mix(in srgb, var(--iris-foreground) 8%, var(--iris-surface)) 50%,
    var(--iris-surface) 100%
  );
  background-size: 200% 100%;
  animation: iris-skeleton-shimmer 1.4s linear infinite;
}
[data-iris-skeleton-shape="circle"] {
  border-radius: 50%;
}
[data-iris-skeleton-shape="text"] {
  border-radius: 4px;
}
@media (prefers-reduced-motion: reduce) {
  [data-iris-skeleton][data-iris-skeleton-animated="true"] {
    animation: none;
  }
}
`.trim()

let skeletonStyleInstalled = false

export function installSkeletonStyles(): void {
  if (skeletonStyleInstalled) return
  if (typeof document === 'undefined') return
  if (document.getElementById(SKELETON_STYLE_ID)) {
    skeletonStyleInstalled = true
    return
  }
  const el = document.createElement('style')
  el.id = SKELETON_STYLE_ID
  el.textContent = SKELETON_CSS
  document.head.appendChild(el)
  skeletonStyleInstalled = true
}

export function resetSkeletonStyles(): void {
  skeletonStyleInstalled = false
  if (typeof document !== 'undefined') {
    document.getElementById(SKELETON_STYLE_ID)?.remove()
  }
}

function defaultHeight(shape: IrisSkeletonShape, w: string | number | undefined): string {
  if (shape === 'text') return '1em'
  if (shape === 'circle') return typeof w === 'number' ? `${w}px` : (w ?? '40px')
  return 'auto'
}

function defaultWidth(shape: IrisSkeletonShape): string {
  if (shape === 'text') return '100%'
  if (shape === 'circle') return '40px'
  return '100%'
}

function toCss(value: string | number): string {
  return typeof value === 'number' ? `${value}px` : value
}

export interface IrisSkeletonProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children'> {
  width?: string | number
  height?: string | number
  shape?: IrisSkeletonShape
  animated?: boolean
}

/**
 * Loading placeholder. Three shapes (rect / circle / text) with shimmer
 * animation that respects `prefers-reduced-motion`.
 */
export function IrisSkeleton(props: IrisSkeletonProps): JSX.Element {
  const merged = mergeProps({ shape: 'rect' as IrisSkeletonShape, animated: true }, props)
  const [local, rest] = splitProps(merged, ['width', 'height', 'shape', 'animated', 'style'])

  const { t } = useI18n()

  onMount(installSkeletonStyles)

  const w = () => (local.width !== undefined ? toCss(local.width) : defaultWidth(local.shape))
  const h = () =>
    local.height !== undefined ? toCss(local.height) : defaultHeight(local.shape, local.width)

  return (
    <div
      {...rest}
      data-iris-skeleton=""
      data-iris-skeleton-shape={local.shape}
      data-iris-skeleton-animated={String(local.animated)}
      role="status"
      aria-busy="true"
      aria-label={t('skeleton.loading')}
      style={{
        width: w(),
        height: h(),
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    />
  )
}

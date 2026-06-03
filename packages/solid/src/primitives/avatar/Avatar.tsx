import { createSignal, mergeProps, Show, splitProps, type JSX } from 'solid-js'

export type IrisAvatarShape = 'circle' | 'square'
export type IrisAvatarSize = 'sm' | 'md' | 'lg' | number

const SIZE_MAP: Record<Exclude<IrisAvatarSize, number>, number> = { sm: 24, md: 32, lg: 48 }
const resolveSize = (size: IrisAvatarSize): number =>
  typeof size === 'number' ? size : SIZE_MAP[size]

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export interface IrisAvatarProps extends Omit<JSX.HTMLAttributes<HTMLSpanElement>, 'children'> {
  src?: string
  alt?: string
  /** Used to derive initials when no `fallback` is supplied. */
  name?: string
  /** Explicit fallback string; wins over derived initials. */
  fallback?: string
  /** Custom fallback content. */
  fallbackContent?: JSX.Element
  size?: IrisAvatarSize
  shape?: IrisAvatarShape
}

/** Solid port of the React/Vue IrisAvatar. */
export function IrisAvatar(props: IrisAvatarProps): JSX.Element {
  const merged = mergeProps(
    {
      src: '',
      alt: '',
      name: '',
      fallback: '',
      size: 'md' as IrisAvatarSize,
      shape: 'circle' as IrisAvatarShape,
    },
    props,
  )
  const [local, others] = splitProps(merged, [
    'src',
    'alt',
    'name',
    'fallback',
    'fallbackContent',
    'size',
    'shape',
    'style',
  ])
  const [failed, setFailed] = createSignal(false)

  const px = (): number => resolveSize(local.size)
  const showImage = (): boolean => Boolean(local.src) && !failed()
  const initials = (): string => local.fallback || (local.name ? initialsFromName(local.name) : '')

  return (
    <span
      {...others}
      data-iris-avatar=""
      data-iris-avatar-shape={local.shape}
      data-iris-avatar-state={showImage() ? 'image' : 'fallback'}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        'justify-content': 'center',
        width: `${px()}px`,
        height: `${px()}px`,
        'border-radius': local.shape === 'circle' ? '50%' : 'var(--iris-radius-sm, 4px)',
        background: 'var(--iris-surface)',
        color: 'var(--iris-foreground)',
        'font-size': `${Math.max(10, Math.round(px() * 0.4))}px`,
        'font-weight': 600,
        'line-height': 1,
        overflow: 'hidden',
        'user-select': 'none',
        'vertical-align': 'middle',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <Show when={showImage()} fallback={local.fallbackContent ?? initials()}>
        <img
          src={local.src}
          alt={local.alt}
          data-iris-avatar-img=""
          style={{ width: '100%', height: '100%', 'object-fit': 'cover', display: 'block' }}
          onError={() => setFailed(true)}
        />
      </Show>
    </span>
  )
}

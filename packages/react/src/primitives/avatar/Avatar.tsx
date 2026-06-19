import * as React from 'react'

export type IrisAvatarShape = 'circle' | 'square'
export type IrisAvatarSize = 'sm' | 'md' | 'lg' | number

const SIZE_MAP: Record<Exclude<IrisAvatarSize, number>, number> = {
  sm: 24,
  md: 32,
  lg: 48,
}

function resolveSize(size: IrisAvatarSize): number {
  return typeof size === 'number' ? size : SIZE_MAP[size]
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export interface IrisAvatarProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  src?: string
  alt?: string
  /** Used to derive initials when no `fallback` slot is supplied. */
  name?: string
  /** Explicit fallback string; wins over derived initials. */
  fallback?: string
  /** Custom fallback content (React node). */
  fallbackContent?: React.ReactNode
  size?: IrisAvatarSize
  shape?: IrisAvatarShape
}

/**
 * React port of {@link import('@iris-ui/vue').IrisAvatar}.
 *
 * @example
 *   <IrisAvatar src="/me.png" name="Ada Lovelace" size="md" />
 */
export function IrisAvatar({
  src = '',
  alt = '',
  name = '',
  fallback = '',
  fallbackContent,
  size = 'md',
  shape = 'circle',
  style,
  ...rest
}: IrisAvatarProps): React.ReactElement {
  const [failed, setFailed] = React.useState(false)

  // Reset failure when src changes.
  React.useEffect(() => {
    setFailed(false)
  }, [src])

  const px = resolveSize(size)
  const showImage = Boolean(src) && !failed
  const initials = fallback || (name ? initialsFromName(name) : '')

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: px,
    height: px,
    borderRadius: shape === 'circle' ? '50%' : 'var(--iris-radius-sm, 4px)',
    background: 'var(--iris-surface)',
    color: 'var(--iris-foreground)',
    fontSize: Math.max(10, Math.round(px * 0.4)),
    fontWeight: 600,
    lineHeight: 1,
    overflow: 'hidden',
    userSelect: 'none',
    verticalAlign: 'middle',
    ...style,
  }

  return (
    <span
      {...rest}
      data-iris-avatar=""
      data-iris-avatar-shape={shape}
      data-iris-avatar-state={showImage ? 'image' : 'fallback'}
      style={containerStyle}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          data-iris-avatar-img=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setFailed(true)}
        />
      ) : (
        (fallbackContent ?? initials)
      )}
    </span>
  )
}

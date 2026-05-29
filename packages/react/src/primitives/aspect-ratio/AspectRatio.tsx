import * as React from 'react'

export interface IrisAspectRatioProps {
  /** Width / height ratio. Default 16/9. */
  ratio?: number
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

/**
 * Aspect-ratio box: constrains its content to a fixed width/height ratio (via
 * the CSS `aspect-ratio` property), with an absolutely-filled content layer —
 * handy for images, video, and iframe embeds.
 *
 * React port of {@link import('@iris-ui/vue').IrisAspectRatio}.
 */
export function IrisAspectRatio({
  ratio = 16 / 9,
  children,
  style,
  className,
}: IrisAspectRatioProps): React.ReactElement {
  return (
    <div
      data-iris-aspect-ratio=""
      data-ratio={ratio}
      className={className}
      style={{ position: 'relative', width: '100%', aspectRatio: String(ratio), ...style }}
    >
      <div
        data-iris-aspect-ratio-content=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {children}
      </div>
    </div>
  )
}

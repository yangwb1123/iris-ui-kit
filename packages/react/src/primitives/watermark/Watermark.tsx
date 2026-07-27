import * as React from 'react'

export interface IrisWatermarkProps {
  /** Watermark text, tiled across the area. */
  content: string
  /** Content the watermark overlays. */
  children?: React.ReactNode
  /** Rotation of each tile in degrees. */
  rotate?: number
  fontSize?: number
  color?: string
  /** Overlay opacity (0–1). */
  opacity?: number
  /** Spacing between tiles in px. */
  gap?: number
  style?: React.CSSProperties
  className?: string
}

/** Number of tiles rendered; clipped by the overlay's overflow. */
const TILE_COUNT = 72

/**
 * Watermark: overlays tiled, rotated text over its content — for confidential
 * or branded surfaces. The overlay is `aria-hidden`, non-selectable, and
 * `pointer-events: none`, so it never interferes with the underlying UI. Built
 * from structured `<span>` nodes (no raw HTML / canvas / SVG-string injection).
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisWatermark}.
 */
export function IrisWatermark({
  content,
  children,
  rotate = -22,
  fontSize = 16,
  color = 'var(--iris-muted)',
  opacity = 0.15,
  gap = 24,
  style,
  className,
  ...rest
}: IrisWatermarkProps): React.ReactElement {
  return (
    <div
      data-iris-watermark=""
      className={className}
      {...rest}
      style={{ position: 'relative', ...style }}
    >
      {children}
      <div
        data-iris-watermark-overlay=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          userSelect: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          alignContent: 'flex-start',
          gap,
          opacity,
        }}
      >
        {Array.from({ length: TILE_COUNT }, (_, i) => (
          <span
            key={i}
            data-iris-watermark-tile=""
            style={{
              transform: `rotate(${rotate}deg)`,
              fontSize,
              color,
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            {content}
          </span>
        ))}
      </div>
    </div>
  )
}

import { For, mergeProps, splitProps, type JSX } from 'solid-js'

const TILE_COUNT = 72

export interface IrisWatermarkProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Watermark text, tiled across the area. */
  content: string
  /** Rotation of each tile in degrees. */
  rotate?: number
  fontSize?: number
  color?: string
  /** Overlay opacity (0–1). */
  opacity?: number
  /** Spacing between tiles in px. */
  gap?: number
  children?: JSX.Element
}

/**
 * Watermark: overlays tiled, rotated text over its slot content — for
 * confidential or branded surfaces. The overlay is aria-hidden,
 * non-selectable, and pointer-events: none.
 */
export function IrisWatermark(props: IrisWatermarkProps): JSX.Element {
  const merged = mergeProps(
    {
      rotate: -22,
      fontSize: 16,
      color: 'var(--iris-muted)',
      opacity: 0.15,
      gap: 24,
    },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'content',
    'rotate',
    'fontSize',
    'color',
    'opacity',
    'gap',
    'style',
    'children',
  ])

  return (
    <div
      {...rest}
      data-iris-watermark=""
      style={{
        position: 'relative',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      {local.children}
      <div
        data-iris-watermark-overlay=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '0',
          overflow: 'hidden',
          'pointer-events': 'none',
          'user-select': 'none',
          display: 'flex',
          'flex-wrap': 'wrap',
          'align-content': 'flex-start',
          gap: `${local.gap}px`,
          opacity: String(local.opacity),
        }}
      >
        <For each={Array.from({ length: TILE_COUNT }, (_, i) => i)}>
          {(_i) => (
            <span
              data-iris-watermark-tile=""
              style={{
                transform: `rotate(${local.rotate}deg)`,
                'font-size': `${local.fontSize}px`,
                color: local.color,
                'white-space': 'nowrap',
                'line-height': '1',
              }}
            >
              {local.content}
            </span>
          )}
        </For>
      </div>
    </div>
  )
}

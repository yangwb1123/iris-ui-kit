import { defineComponent, h } from 'vue'

/** Number of tiles rendered; clipped by the overlay's overflow. */
const TILE_COUNT = 72

/**
 * Watermark: overlays tiled, rotated text over its slot content — for
 * confidential or branded surfaces. The overlay is `aria-hidden`,
 * non-selectable, and `pointer-events: none`, so it never interferes with the
 * underlying UI. Built from structured `<span>` nodes (no raw HTML / canvas /
 * SVG-string injection).
 */
export const IrisWatermark = defineComponent({
  name: 'IrisWatermark',
  inheritAttrs: false,
  props: {
    /** Watermark text, tiled across the area. */
    content: { type: String, required: true },
    /** Rotation of each tile in degrees. */
    rotate: { type: Number, default: -22 },
    fontSize: { type: Number, default: 16 },
    color: { type: String, default: 'var(--iris-muted)' },
    /** Overlay opacity (0–1). */
    opacity: { type: Number, default: 0.15 },
    /** Spacing between tiles in px. */
    gap: { type: Number, default: 24 },
  },
  setup(props, { attrs, slots }) {
    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-watermark': '',
          style: {
            position: 'relative',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          slots.default?.(),
          h(
            'div',
            {
              'data-iris-watermark-overlay': '',
              'aria-hidden': 'true',
              style: {
                position: 'absolute',
                inset: '0',
                overflow: 'hidden',
                pointerEvents: 'none',
                userSelect: 'none',
                display: 'flex',
                flexWrap: 'wrap',
                alignContent: 'flex-start',
                gap: `${props.gap}px`,
                opacity: String(props.opacity),
              },
            },
            Array.from({ length: TILE_COUNT }, (_unused, i) =>
              h(
                'span',
                {
                  key: i,
                  'data-iris-watermark-tile': '',
                  style: {
                    transform: `rotate(${props.rotate}deg)`,
                    fontSize: `${props.fontSize}px`,
                    color: props.color,
                    whiteSpace: 'nowrap',
                    lineHeight: '1',
                  },
                },
                props.content,
              ),
            ),
          ),
        ],
      )
  },
})

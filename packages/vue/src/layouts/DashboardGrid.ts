import { defineComponent, h } from 'vue'

/**
 * 12-column responsive grid for dashboard composition. Each child should be
 * an `IrisDashboardCard` (or any element with `grid-column: span N`).
 *
 * Children control their span via inline `style="grid-column: span N"` or
 * by wrapping with `IrisDashboardCard` whose `col-span` / `row-span` props
 * compile to the same CSS.
 */
export const IrisDashboardGrid = defineComponent({
  name: 'IrisDashboardGrid',
  inheritAttrs: false,
  props: {
    columns: { type: Number, default: 12 },
    gap: { type: [Number, String], default: 16 },
    /** Minimum column width via `grid-template-columns: repeat(auto-fill, minmax(...))`. */
    minColWidth: { type: [Number, String], default: undefined },
  },
  setup(props, { slots, attrs }) {
    const gap = typeof props.gap === 'number' ? `${props.gap}px` : props.gap
    return () => {
      const gridTemplateColumns = props.minColWidth
        ? `repeat(auto-fill, minmax(${typeof props.minColWidth === 'number' ? `${props.minColWidth}px` : props.minColWidth}, 1fr))`
        : `repeat(${props.columns}, 1fr)`
      return h(
        'div',
        {
          ...attrs,
          'data-iris-dashboard-grid': '',
          style: {
            display: 'grid',
            gap,
            gridTemplateColumns,
            width: '100%',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
    }
  },
})

/**
 * A single grid cell — wraps content in a styled card with optional span
 * controls. `col-span` accepts a number (column count) or `'full'` to fill
 * the entire row.
 */
export const IrisDashboardCard = defineComponent({
  name: 'IrisDashboardCard',
  inheritAttrs: false,
  props: {
    colSpan: { type: [Number, String], default: 1 },
    rowSpan: { type: Number, default: 1 },
    /** Show a styled card surface (background + border). Default `true`. */
    surface: { type: Boolean, default: true },
  },
  setup(props, { slots, attrs }) {
    return () => {
      const colSpan = props.colSpan === 'full' ? '1 / -1' : `span ${props.colSpan}`
      const rowSpan = props.rowSpan > 1 ? `span ${props.rowSpan}` : undefined
      return h(
        'div',
        {
          ...attrs,
          'data-iris-dashboard-card': '',
          style: {
            gridColumn: colSpan,
            gridRow: rowSpan,
            background: props.surface ? 'var(--iris-surface)' : 'transparent',
            border: props.surface ? '1px solid var(--iris-border)' : 'none',
            borderRadius: 'var(--iris-radius-md)',
            padding: props.surface ? 'var(--iris-padding-lg)' : '0',
            minWidth: '0',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
    }
  },
})

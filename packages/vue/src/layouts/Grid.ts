import { computed, defineComponent, h, type PropType } from 'vue'

export type IrisGridColumns =
  number | 'auto-fit' | 'auto-fill' | string /* raw grid-template-columns value */

function resolveColumns(columns: IrisGridColumns, minColWidth: string): string {
  if (typeof columns === 'number') return `repeat(${columns}, minmax(0, 1fr))`
  if (columns === 'auto-fit') return `repeat(auto-fit, minmax(${minColWidth}, 1fr))`
  if (columns === 'auto-fill') return `repeat(auto-fill, minmax(${minColWidth}, 1fr))`
  return columns
}

function toCssSpacing(spacing: string | number): string {
  if (typeof spacing === 'number') return `${spacing}px`
  if (spacing === 'sm' || spacing === 'md' || spacing === 'lg') {
    return `var(--iris-gap-${spacing})`
  }
  return spacing
}

/**
 * Two-dimensional grid layout primitive. Three column modes:
 *
 *   - **Fixed integer** — `columns={3}` → three equal-width columns.
 *   - **Responsive auto-fit** — `columns="auto-fit"` + `minColWidth` → fluid
 *     grid where columns add/remove with container width. Most common.
 *   - **Raw CSS** — pass any `grid-template-columns` string.
 *
 * Spacing accepts token shorthand (`sm` / `md` / `lg`), numeric px, or any
 * CSS length string. `gap` is a shortcut for both row + column gap.
 */
export const IrisGrid = defineComponent({
  name: 'IrisGrid',
  inheritAttrs: false,
  props: {
    columns: { type: [Number, String] as PropType<IrisGridColumns>, default: 'auto-fit' },
    /** Min width per column for `auto-fit` / `auto-fill`. */
    minColWidth: { type: String, default: '200px' },
    /** Row gap (token / px / CSS). */
    rowGap: { type: [String, Number], default: undefined },
    /** Column gap (token / px / CSS). */
    columnGap: { type: [String, Number], default: undefined },
    /** Shorthand for both row + column gap. Overridden if rowGap/columnGap given. */
    gap: { type: [String, Number], default: 'md' },
    inline: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const style = computed<Record<string, string>>(() => {
      const colTemplate = resolveColumns(props.columns, props.minColWidth)
      const rowGap =
        props.rowGap !== undefined ? toCssSpacing(props.rowGap) : toCssSpacing(props.gap)
      const colGap =
        props.columnGap !== undefined ? toCssSpacing(props.columnGap) : toCssSpacing(props.gap)
      return {
        display: props.inline ? 'inline-grid' : 'grid',
        gridTemplateColumns: colTemplate,
        rowGap,
        columnGap: colGap,
      }
    })

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-grid': '',
          'data-iris-grid-columns': String(props.columns),
          style: { ...style.value, ...((attrs.style as Record<string, string> | undefined) ?? {}) },
        },
        slots.default?.(),
      )
  },
})

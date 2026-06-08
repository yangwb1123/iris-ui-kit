import { createMemo, mergeProps, splitProps, type JSX } from 'solid-js'

export type IrisGridColumns = number | 'auto-fit' | 'auto-fill' | string

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

export interface IrisGridProps {
  columns?: IrisGridColumns
  minColWidth?: string
  rowGap?: string | number
  columnGap?: string | number
  gap?: string | number
  inline?: boolean
  class?: string
  style?: JSX.CSSProperties
  children?: JSX.Element
}

/**
 * Two-dimensional grid layout primitive. Solid port of the Vue IrisGrid.
 */
export function IrisGrid(props: IrisGridProps): JSX.Element {
  const merged = mergeProps(
    {
      columns: 'auto-fit' as IrisGridColumns,
      minColWidth: '200px',
      gap: 'md' as string | number,
      inline: false,
    },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'columns',
    'minColWidth',
    'rowGap',
    'columnGap',
    'gap',
    'inline',
    'class',
    'style',
    'children',
  ])

  const gridStyle = createMemo<JSX.CSSProperties>(() => ({
    display: local.inline ? 'inline-grid' : 'grid',
    'grid-template-columns': resolveColumns(local.columns, local.minColWidth),
    'row-gap': local.rowGap !== undefined ? toCssSpacing(local.rowGap) : toCssSpacing(local.gap),
    'column-gap':
      local.columnGap !== undefined ? toCssSpacing(local.columnGap) : toCssSpacing(local.gap),
    ...(local.style ?? {}),
  }))

  return (
    <div
      {...(rest as JSX.HTMLAttributes<HTMLDivElement>)}
      data-iris-grid=""
      data-iris-grid-columns={String(local.columns)}
      class={local.class}
      style={gridStyle()}
    >
      {local.children}
    </div>
  )
}

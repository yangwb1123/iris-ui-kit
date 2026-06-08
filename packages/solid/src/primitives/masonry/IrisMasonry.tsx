import { children, For, mergeProps, type JSX } from 'solid-js'

export interface IrisMasonryProps {
  /** Number of columns. */
  columns?: number
  /** Gap between items (px). */
  gap?: number
  children?: JSX.Element
  style?: JSX.CSSProperties
}

/**
 * Masonry layout: flows children into balanced columns via CSS multi-column,
 * with each item kept from breaking across columns.
 * Solid port of the Vue IrisMasonry.
 */
export function IrisMasonry(props: IrisMasonryProps): JSX.Element {
  const merged = mergeProps({ columns: 3, gap: 16 }, props)

  // Use children() to resolve and iterate over slot items
  const resolved = children(() => merged.children)

  const items = (): JSX.Element[] => {
    const c = resolved()
    if (Array.isArray(c)) return c as JSX.Element[]
    if (c != null) return [c as JSX.Element]
    return []
  }

  return (
    <div
      data-iris-masonry=""
      data-columns={merged.columns}
      style={{
        'column-count': String(merged.columns),
        'column-gap': `${merged.gap}px`,
        ...(merged.style ?? {}),
      }}
    >
      <For each={items()}>
        {(child) => (
          <div
            data-iris-masonry-item=""
            style={{ 'break-inside': 'avoid', 'margin-block-end': `${merged.gap}px` }}
          >
            {child}
          </div>
        )}
      </For>
    </div>
  )
}

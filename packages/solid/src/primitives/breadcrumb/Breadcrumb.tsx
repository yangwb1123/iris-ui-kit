import { children, For, mergeProps, Show, type JSX } from 'solid-js'

export interface IrisBreadcrumbProps {
  /** Separator between crumbs. Default `/`. */
  separator?: JSX.Element
  class?: string
  style?: JSX.CSSProperties
  children?: JSX.Element
}

/**
 * Container for breadcrumb navigation — `<nav><ol>` per WAI-ARIA, with a
 * separator inserted between items. Children should be `IrisBreadcrumbItem`s;
 * the last one should set `current` (the data-driven `IrisAdminBreadcrumb` does
 * this for you). Solid has no `cloneElement`, so unlike React/Vue the last
 * crumb is not auto-marked — set `current` explicitly.
 */
export function IrisBreadcrumb(props: IrisBreadcrumbProps): JSX.Element {
  const merged = mergeProps({ separator: '/' as JSX.Element }, props)
  const resolved = children(() => props.children)
  const items = (): unknown[] => resolved.toArray()

  return (
    <nav aria-label="Breadcrumb" data-iris-breadcrumb="" class={merged.class} style={merged.style}>
      <ol
        style={{
          display: 'inline-flex',
          'align-items': 'center',
          gap: '6px',
          margin: 0,
          padding: 0,
          'list-style': 'none',
          'font-size': '14px',
        }}
      >
        <For each={items()}>
          {(item, i) => (
            <>
              <li
                data-iris-breadcrumb-item=""
                data-iris-breadcrumb-last={i() === items().length - 1 ? 'true' : undefined}
                style={{ display: 'inline-flex', 'align-items': 'center' }}
              >
                {item as JSX.Element}
              </li>
              <Show when={i() !== items().length - 1}>
                <li
                  data-iris-breadcrumb-separator=""
                  aria-hidden="true"
                  style={{
                    color: 'var(--iris-muted)',
                    display: 'inline-flex',
                    'align-items': 'center',
                  }}
                >
                  {merged.separator}
                </li>
              </Show>
            </>
          )}
        </For>
      </ol>
    </nav>
  )
}

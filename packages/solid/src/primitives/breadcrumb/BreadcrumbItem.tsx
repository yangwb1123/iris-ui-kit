import { mergeProps, Show, splitProps, type JSX } from 'solid-js'

export interface IrisBreadcrumbItemProps extends JSX.HTMLAttributes<HTMLElement> {
  href?: string
  /** Marks this crumb as the current page (plain text + `aria-current="page"`). */
  current?: boolean
}

/**
 * A single breadcrumb crumb — renders an `<a>` when `href` is given and not
 * current, else a `<span>`. Passthrough attributes (e.g. `data-*`, `onClick`)
 * are forwarded. Solid port of the React/Vue `IrisBreadcrumbItem` (`current`
 * is explicit here; see `IrisBreadcrumb`).
 */
export function IrisBreadcrumbItem(props: IrisBreadcrumbItemProps): JSX.Element {
  const merged = mergeProps({ current: false }, props)
  const [local, others] = splitProps(merged, ['href', 'current', 'style', 'children'])
  const style = (): JSX.CSSProperties => ({
    color: local.current ? 'var(--iris-muted)' : 'var(--iris-primary)',
    'text-decoration': 'none',
    cursor: local.current ? 'default' : local.href ? 'pointer' : 'default',
    ...((local.style as JSX.CSSProperties) ?? {}),
  })

  return (
    <Show
      when={local.href && !local.current}
      fallback={
        <span
          {...others}
          data-iris-breadcrumb-crumb=""
          aria-current={local.current ? 'page' : undefined}
          style={style()}
        >
          {local.children}
        </span>
      }
    >
      <a {...others} data-iris-breadcrumb-crumb="" href={local.href} style={style()}>
        {local.children}
      </a>
    </Show>
  )
}

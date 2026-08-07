/**
 * Singleton stylesheet for breadcrumb separators. Svelte snippets can't be
 * introspected to interleave a separator between crumbs the way Solid's
 * `children().toArray()` does, so the separator is a CSS `::before` driven by the
 * `--iris-breadcrumb-sep` custom property the container sets per instance. The
 * separator is decorative (CSS content is not announced by screen readers), so
 * a11y matches the sibling adapters' `aria-hidden` separator elements.
 */
const STYLE_ID = 'iris-breadcrumb-styles'

const CSS = `
[data-iris-breadcrumb-list] {
  display: inline-flex;
  align-items: center;
  gap: var(--iris-space-xs, 8px);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--iris-font-size-md, 14px);
}
[data-iris-breadcrumb-item] {
  display: inline-flex;
  align-items: center;
  gap: var(--iris-space-xs, 8px);
}
[data-iris-breadcrumb-item]:not(:first-child)::before {
  content: var(--iris-breadcrumb-sep, "/");
  color: var(--iris-muted);
}
`

let installed = false

export function installBreadcrumbStyles(): void {
  if (installed) return
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) {
    installed = true
    return
  }
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
  installed = true
}

/** Test-only reset. */
export function __resetBreadcrumbStyles(): void {
  installed = false
  if (typeof document === 'undefined') return
  document.getElementById(STYLE_ID)?.remove()
}

export const __BREADCRUMB_STYLE_ID = STYLE_ID

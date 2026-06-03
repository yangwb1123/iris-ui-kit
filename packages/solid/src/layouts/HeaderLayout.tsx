import { mergeProps, Show, type JSX } from 'solid-js'

export interface IrisHeaderLayoutProps {
  headerHeight?: number | string
  footerHeight?: number | string
  /** Header sticks via `position: sticky` instead of static. Default true. */
  sticky?: boolean
  header?: JSX.Element
  footer?: JSX.Element
  class?: string
  style?: JSX.CSSProperties
  children?: JSX.Element
}

const asLen = (v: number | string): string => (typeof v === 'number' ? `${v}px` : v)

/**
 * Vertical three-region layout: a sticky header, a scrollable main region, and
 * an optional footer. Solid port of the React/Vue IrisHeaderLayout.
 */
export function IrisHeaderLayout(props: IrisHeaderLayoutProps): JSX.Element {
  const merged = mergeProps(
    {
      headerHeight: 'auto' as number | string,
      footerHeight: 'auto' as number | string,
      sticky: true,
    },
    props,
  )
  return (
    <div
      data-iris-header-layout=""
      class={merged.class}
      style={{
        display: 'flex',
        'flex-direction': 'column',
        width: '100%',
        height: '100%',
        'min-height': 0,
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        ...(merged.style ?? {}),
      }}
    >
      <Show when={merged.header}>
        <header
          role="banner"
          data-iris-header=""
          style={{
            'flex-shrink': 0,
            height: asLen(merged.headerHeight),
            'border-bottom': '1px solid var(--iris-border)',
            background: 'var(--iris-surface)',
            position: merged.sticky ? 'sticky' : 'static',
            top: 0,
            'z-index': 50,
          }}
        >
          {merged.header}
        </header>
      </Show>
      <main
        role="main"
        data-iris-header-main=""
        style={{ flex: 1, 'min-height': 0, overflow: 'auto' }}
      >
        {props.children}
      </main>
      <Show when={merged.footer}>
        <footer
          role="contentinfo"
          data-iris-footer=""
          style={{
            'flex-shrink': 0,
            height: asLen(merged.footerHeight),
            'border-top': '1px solid var(--iris-border)',
            background: 'var(--iris-surface)',
          }}
        >
          {merged.footer}
        </footer>
      </Show>
    </div>
  )
}

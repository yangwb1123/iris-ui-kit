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

const asLen = (value: number | string): string => (typeof value === 'number' ? `${value}px` : value)

const HeaderLayoutFrame = (
  props: Required<Pick<IrisHeaderLayoutProps, 'headerHeight' | 'footerHeight' | 'sticky'>> &
    IrisHeaderLayoutProps,
): JSX.Element => (
  <div
    data-iris-header-layout=""
    class={props.class}
    style={{
      display: 'flex',
      'flex-direction': 'column',
      width: '100%',
      height: '100%',
      'min-height': 0,
      background: 'var(--iris-background)',
      color: 'var(--iris-foreground)',
      ...(props.style ?? {}),
    }}
  >
    <Show when={props.header}>
      <header
        role="banner"
        data-iris-header=""
        style={{
          'flex-shrink': 0,
          height: asLen(props.headerHeight),
          'border-bottom': '1px solid var(--iris-border)',
          background: 'var(--iris-surface)',
          position: props.sticky ? 'sticky' : 'static',
          top: 0,
          'z-index': 50,
        }}
      >
        {props.header}
      </header>
    </Show>
    <main
      role="main"
      data-iris-header-main=""
      style={{ flex: 1, 'min-height': 0, overflow: 'auto' }}
    >
      {props.children}
    </main>
    <Show when={props.footer}>
      <footer
        role="contentinfo"
        data-iris-footer=""
        style={{
          'flex-shrink': 0,
          height: asLen(props.footerHeight),
          'border-top': '1px solid var(--iris-border)',
          background: 'var(--iris-surface)',
        }}
      >
        {props.footer}
      </footer>
    </Show>
  </div>
)

/** Vertical three-region layout with optional sticky header and footer. */
export function IrisHeaderLayout(props: IrisHeaderLayoutProps): JSX.Element {
  const merged = mergeProps(
    {
      headerHeight: 'auto' as number | string,
      footerHeight: 'auto' as number | string,
      sticky: true,
    },
    props,
  )
  return <HeaderLayoutFrame {...merged} />
}

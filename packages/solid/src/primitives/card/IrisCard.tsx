import { mergeProps, onMount, Show, splitProps, type JSX } from 'solid-js'

const STYLE_ID = 'iris-card-styles'
let installed = false
function installCardStyles() {
  if (installed || typeof document === 'undefined') return
  installed = true
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
[data-iris-card-hover="true"]:hover {
  transform: translateY(-2px);
  box-shadow: var(--iris-shadow-md);
}
`
  document.head.appendChild(style)
}
export type IrisCardVariant = 'elevated' | 'outline' | 'subtle'
export type IrisCardPadding = 'none' | 'sm' | 'md' | 'lg'

const PADDING_MAP: Record<IrisCardPadding, string> = {
  none: '0',
  sm: '12px',
  md: 'var(--iris-padding-md, 16px)',
  lg: '24px',
}

export interface IrisCardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  variant?: IrisCardVariant
  padding?: IrisCardPadding
  hover?: boolean
  header?: JSX.Element
  footer?: JSX.Element
  children?: JSX.Element
}

function containerStyle(variant: IrisCardVariant, hover: boolean): JSX.CSSProperties {
  const base: JSX.CSSProperties = {
    display: 'flex',
    'flex-direction': 'column',
    background: 'var(--iris-background)',
    color: 'var(--iris-foreground)',
    'border-radius': 'var(--iris-radius-md, 8px)',
    overflow: 'hidden',
    transition: hover ? 'transform 160ms ease, box-shadow 160ms ease' : 'none',
  }
  if (variant === 'elevated') return { ...base, 'box-shadow': 'var(--iris-shadow-md)' }
  if (variant === 'outline') return { ...base, border: '1px solid var(--iris-border)' }
  return { ...base, background: 'var(--iris-surface)' }
}

/**
 * Card surface with three visual variants: elevated (default), outline, subtle.
 * Slots: header, default body, footer.
 */
export function IrisCard(props: IrisCardProps): JSX.Element {
  const merged = mergeProps(
    { variant: 'elevated' as IrisCardVariant, padding: 'md' as IrisCardPadding, hover: false },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'variant',
    'padding',
    'hover',
    'header',
    'footer',
    'style',
    'children',
  ])

  const sectionPadding = () => PADDING_MAP[local.padding]

  onMount(installCardStyles)
  return (
    <div
      {...rest}
      data-iris-card=""
      data-iris-card-variant={local.variant}
      data-iris-card-padding={local.padding}
      data-iris-card-hover={local.hover ? 'true' : undefined}
      style={{
        ...containerStyle(local.variant, local.hover),
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <Show when={local.header}>
        <div
          data-iris-card-header=""
          style={{
            padding: sectionPadding(),
            'border-bottom': '1px solid var(--iris-border)',
            'font-weight': '600',
          }}
        >
          {local.header}
        </div>
      </Show>
      <Show when={local.children}>
        <div data-iris-card-body="" style={{ padding: sectionPadding(), flex: '1' }}>
          {local.children}
        </div>
      </Show>
      <Show when={local.footer}>
        <div
          data-iris-card-footer=""
          style={{
            padding: sectionPadding(),
            'border-top': '1px solid var(--iris-border)',
          }}
        >
          {local.footer}
        </div>
      </Show>
    </div>
  )
}

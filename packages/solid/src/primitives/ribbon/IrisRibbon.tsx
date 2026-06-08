import { mergeProps, splitProps, type JSX } from 'solid-js'

export type IrisRibbonPlacement = 'start' | 'end'

export interface IrisRibbonProps extends JSX.HTMLAttributes<HTMLDivElement> {
  text?: string | number
  /** Corner: 'end' = top inline-end; 'start' = top inline-start. */
  placement?: IrisRibbonPlacement
  /** Badge background (defaults to the primary color). */
  color?: string
  children?: JSX.Element
}

/**
 * Ribbon: a corner badge ("New", "Sale", …) anchored to the top corner of its
 * slot content. RTL-safe via logical insets/radii.
 */
export function IrisRibbon(props: IrisRibbonProps): JSX.Element {
  const merged = mergeProps({ text: '', placement: 'end' as IrisRibbonPlacement }, props)
  const [local, rest] = splitProps(merged, ['text', 'placement', 'color', 'style', 'children'])

  const sideStyle = (): JSX.CSSProperties =>
    local.placement === 'end'
      ? {
          'inset-inline-end': '0',
          'border-start-start-radius': 'var(--iris-radius-sm, 4px)',
          'border-end-start-radius': 'var(--iris-radius-sm, 4px)',
        }
      : {
          'inset-inline-start': '0',
          'border-start-end-radius': 'var(--iris-radius-sm, 4px)',
          'border-end-end-radius': 'var(--iris-radius-sm, 4px)',
        }

  return (
    <div
      {...rest}
      data-iris-ribbon=""
      data-placement={local.placement}
      style={{
        position: 'relative',
        display: 'inline-block',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      {local.children}
      <span
        data-iris-ribbon-badge=""
        style={{
          position: 'absolute',
          'inset-block-start': '8px',
          background: local.color ?? 'var(--iris-primary)',
          color: '#fff',
          padding: '2px 10px',
          'font-size': '12px',
          'font-weight': '600',
          'box-shadow': '0 2px 5px rgba(0,0,0,0.2)',
          'white-space': 'nowrap',
          ...sideStyle(),
        }}
      >
        {String(local.text)}
      </span>
    </div>
  )
}

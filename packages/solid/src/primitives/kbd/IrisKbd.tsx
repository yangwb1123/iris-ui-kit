import { mergeProps, splitProps, type JSX } from 'solid-js'

export type IrisKbdSize = 'sm' | 'md' | 'lg'

const SIZE_STYLE: Record<IrisKbdSize, JSX.CSSProperties> = {
  sm: { 'font-size': '10px', padding: '1px 4px' },
  md: { 'font-size': '12px', padding: '2px 6px' },
  lg: { 'font-size': '14px', padding: '3px 8px' },
}

export interface IrisKbdProps extends JSX.HTMLAttributes<HTMLElement> {
  size?: IrisKbdSize
  children?: JSX.Element
}

/**
 * Keyboard shortcut badge — renders a <kbd> element styled as a key cap.
 */
export function IrisKbd(props: IrisKbdProps): JSX.Element {
  const merged = mergeProps({ size: 'md' as IrisKbdSize }, props)
  const [local, rest] = splitProps(merged, ['size', 'style', 'children'])

  return (
    <kbd
      {...rest}
      data-iris-kbd=""
      data-iris-kbd-size={local.size}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        'justify-content': 'center',
        'font-family': 'var(--iris-font-mono, monospace)',
        'font-weight': 500,
        'line-height': 1,
        'border-radius': 'var(--iris-radius-sm, 4px)',
        border: '1px solid var(--iris-border)',
        background: 'var(--iris-surface, #f5f5f5)',
        color: 'var(--iris-foreground)',
        'box-shadow': '0 1px 0 1px var(--iris-border)',
        'white-space': 'nowrap',
        ...SIZE_STYLE[local.size],
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      {local.children}
    </kbd>
  )
}

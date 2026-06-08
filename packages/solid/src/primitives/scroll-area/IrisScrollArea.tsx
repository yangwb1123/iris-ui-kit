import { mergeProps, splitProps, type JSX } from 'solid-js'

export type IrisScrollAreaAxis = 'vertical' | 'horizontal' | 'both'

const OVERFLOW: Record<IrisScrollAreaAxis, JSX.CSSProperties> = {
  vertical: { 'overflow-y': 'auto', 'overflow-x': 'hidden' },
  horizontal: { 'overflow-x': 'auto', 'overflow-y': 'hidden' },
  both: { overflow: 'auto' },
}

const px = (v: number | string | undefined): string | undefined =>
  typeof v === 'number' ? `${v}px` : v

export interface IrisScrollAreaProps {
  maxHeight?: number | string
  maxWidth?: number | string
  axis?: IrisScrollAreaAxis
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
  [key: string]: unknown
}

/** Solid port of IrisScrollArea — keyboard-focusable scroll container. */
export function IrisScrollArea(props: IrisScrollAreaProps): JSX.Element {
  const merged = mergeProps({ axis: 'vertical' as IrisScrollAreaAxis }, props)
  const [local, rest] = splitProps(merged, ['maxHeight', 'maxWidth', 'axis', 'children', 'style'])

  return (
    <div
      {...rest}
      data-iris-scroll-area=""
      data-axis={local.axis}
      tabIndex={0}
      style={{
        ...OVERFLOW[local.axis],
        'max-height': px(local.maxHeight),
        'max-width': px(local.maxWidth),
        outline: 'none',
        ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
      }}
    >
      {local.children}
    </div>
  )
}

import { mergeProps, splitProps, type JSX } from 'solid-js'

export type IrisStackDirection = 'row' | 'column'
export type IrisStackAlign = 'start' | 'center' | 'end' | 'stretch'
export type IrisStackJustify = 'start' | 'center' | 'end' | 'between' | 'around'

const ALIGN_MAP: Record<IrisStackAlign, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}
const JUSTIFY_MAP: Record<IrisStackJustify, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
}

function toCssSpacing(spacing: string | number): string {
  if (typeof spacing === 'number') return `${spacing}px`
  if (spacing === 'sm' || spacing === 'md' || spacing === 'lg') return `var(--iris-gap-${spacing})`
  return spacing
}

export interface IrisStackProps extends JSX.HTMLAttributes<HTMLDivElement> {
  direction?: IrisStackDirection
  spacing?: string | number
  align?: IrisStackAlign
  justify?: IrisStackJustify
  wrap?: boolean
  inline?: boolean
}

/** Flex container with token-driven spacing. Solid port of the React/Vue IrisStack. */
export function IrisStack(props: IrisStackProps): JSX.Element {
  const merged = mergeProps(
    {
      direction: 'column' as IrisStackDirection,
      spacing: 'md' as string | number,
      align: 'stretch' as IrisStackAlign,
      justify: 'start' as IrisStackJustify,
      wrap: false,
      inline: false,
    },
    props,
  )
  const [local, others] = splitProps(merged, [
    'direction',
    'spacing',
    'align',
    'justify',
    'wrap',
    'inline',
    'style',
    'children',
  ])
  return (
    <div
      {...others}
      data-iris-stack=""
      data-iris-stack-direction={local.direction}
      style={{
        display: local.inline ? 'inline-flex' : 'flex',
        'flex-direction': local.direction,
        gap: toCssSpacing(local.spacing),
        'align-items': ALIGN_MAP[local.align],
        'justify-content': JUSTIFY_MAP[local.justify],
        'flex-wrap': local.wrap ? 'wrap' : 'nowrap',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      {local.children}
    </div>
  )
}

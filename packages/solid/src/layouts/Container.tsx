import { createMemo, mergeProps, splitProps, type JSX } from 'solid-js'

export type IrisContainerMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | 'full' | string

const WIDTH_MAP: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string> = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: '100%',
}

function resolveMaxWidth(input: IrisContainerMaxWidth): string {
  if (input === 'sm' || input === 'md' || input === 'lg' || input === 'xl' || input === 'full') {
    return WIDTH_MAP[input]
  }
  return input
}

function resolvePadding(input: string | number): string {
  if (typeof input === 'number') return `${input}px`
  if (input === 'sm' || input === 'md' || input === 'lg') {
    return `var(--iris-padding-${input})`
  }
  return input
}

export interface IrisContainerProps {
  maxWidth?: IrisContainerMaxWidth
  padding?: string | number
  center?: boolean
  class?: string
  style?: JSX.CSSProperties
  children?: JSX.Element
}

/**
 * Centered max-width wrapper. Solid port of the Vue IrisContainer.
 */
export function IrisContainer(props: IrisContainerProps): JSX.Element {
  const merged = mergeProps(
    {
      maxWidth: 'lg' as IrisContainerMaxWidth,
      padding: 'md' as string | number,
      center: true,
    },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'maxWidth',
    'padding',
    'center',
    'class',
    'style',
    'children',
  ])

  const containerStyle = createMemo<JSX.CSSProperties>(() => ({
    width: '100%',
    'max-width': resolveMaxWidth(local.maxWidth),
    padding: `0 ${resolvePadding(local.padding)}`,
    ...(local.center ? { 'margin-inline-start': 'auto', 'margin-inline-end': 'auto' } : {}),
    ...(local.style ?? {}),
  }))

  return (
    <div
      {...(rest as JSX.HTMLAttributes<HTMLDivElement>)}
      data-iris-container=""
      data-iris-container-max-width={local.maxWidth}
      class={local.class}
      style={containerStyle()}
    >
      {local.children}
    </div>
  )
}

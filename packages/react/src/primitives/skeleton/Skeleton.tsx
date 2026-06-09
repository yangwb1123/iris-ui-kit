import * as React from 'react'
import { useI18n } from '../../i18n'
import { installSkeletonStyles } from './styles'

export type IrisSkeletonShape = 'rect' | 'circle' | 'text'

function defaultHeight(shape: IrisSkeletonShape, w: string | number | undefined): string {
  if (shape === 'text') return '1em'
  if (shape === 'circle') return typeof w === 'number' ? `${w}px` : (w ?? '40px')
  return 'auto'
}

function defaultWidth(shape: IrisSkeletonShape): string {
  if (shape === 'text') return '100%'
  if (shape === 'circle') return '40px'
  return '100%'
}

function toCss(value: string | number): string {
  return typeof value === 'number' ? `${value}px` : value
}

export interface IrisSkeletonProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  width?: string | number
  height?: string | number
  shape?: IrisSkeletonShape
  animated?: boolean
}

export function IrisSkeleton({
  width,
  height,
  shape = 'rect',
  animated = true,
  style,
  ...rest
}: IrisSkeletonProps): React.ReactElement {
  const { t } = useI18n()
  React.useEffect(installSkeletonStyles, [])
  const w = width !== undefined ? toCss(width) : defaultWidth(shape)
  const h = height !== undefined ? toCss(height) : defaultHeight(shape, width)
  return (
    <div
      {...rest}
      data-iris-skeleton=""
      data-iris-skeleton-shape={shape}
      data-iris-skeleton-animated={String(animated)}
      role="status"
      aria-busy="true"
      aria-label={t('skeleton.loading')}
      style={{ width: w, height: h, ...style }}
    />
  )
}

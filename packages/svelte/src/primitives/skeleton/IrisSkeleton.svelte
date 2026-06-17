<script lang="ts">
  import { installSkeletonStyles } from './styles'
  import { styleToString, mergeStyle } from '../../internal/style'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  type SkeletonShape = 'rect' | 'circle' | 'text'

  function defaultHeight(shape: SkeletonShape, w: string | number | undefined): string {
    if (shape === 'text') return '1em'
    if (shape === 'circle') return typeof w === 'number' ? `${w}px` : (w ?? '40px')
    return 'auto'
  }

  function defaultWidth(shape: SkeletonShape): string {
    if (shape === 'text') return '100%'
    if (shape === 'circle') return '40px'
    return '100%'
  }

  function toCss(value: string | number): string {
    return typeof value === 'number' ? `${value}px` : value
  }

  let {
    width = undefined as string | number | undefined,
    height = undefined as string | number | undefined,
    shape = 'rect' as SkeletonShape,
    animated = true,
    style,
    ...rest
  } = $props()

  const w = $derived(width !== undefined ? toCss(width) : defaultWidth(shape))
  const h = $derived(height !== undefined ? toCss(height) : defaultHeight(shape, width))

  const computedStyle = $derived(styleToString({ width: w, height: h }))

  $effect(() => {
    installSkeletonStyles()
  })
</script>

<div
  {...rest}
  data-iris-skeleton
  data-iris-skeleton-shape={shape}
  data-iris-skeleton-animated={String(animated)}
  role="status"
  aria-busy="true"
  aria-label={t('skeleton.loading')}
  style={mergeStyle(computedStyle, style)}
></div>

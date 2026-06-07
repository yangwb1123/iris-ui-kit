<script module lang="ts">
  const ALIGN_MAP = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    stretch: 'stretch',
  } as const
  const JUSTIFY_MAP = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    between: 'space-between',
    around: 'space-around',
  } as const
</script>

<script lang="ts">
  import { styleToString, toCssSpacing, mergeStyle } from '../internal/style'
  import type { IrisStackProps } from './types'

  let {
    direction = 'column',
    spacing = 'md',
    align = 'stretch',
    justify = 'start',
    wrap = false,
    inline = false,
    style,
    children,
    ...rest
  }: IrisStackProps = $props()

  const base = $derived(
    styleToString({
      display: inline ? 'inline-flex' : 'flex',
      'flex-direction': direction,
      gap: toCssSpacing(spacing),
      'align-items': ALIGN_MAP[align],
      'justify-content': JUSTIFY_MAP[justify],
      'flex-wrap': wrap ? 'wrap' : 'nowrap',
    }),
  )
</script>

<div {...rest} data-iris-stack data-iris-stack-direction={direction} style={mergeStyle(base, style)}>
  {@render children?.()}
</div>

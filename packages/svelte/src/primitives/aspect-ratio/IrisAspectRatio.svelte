<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'

  let {
    ratio = 16 / 9,
    style,
    children,
    ...rest
  } = $props()
</script>

<div
  {...rest}
  data-iris-aspect-ratio
  data-ratio={ratio}
  style={mergeStyle(
    styleToString({
      position: 'relative',
      width: '100%',
      'aspect-ratio': String(ratio),
    }),
    style,
  )}
>
  <div
    data-iris-aspect-ratio-content
    style="position: absolute; inset: 0; width: 100%; height: 100%"
  >
    {@render children?.()}
  </div>
</div>

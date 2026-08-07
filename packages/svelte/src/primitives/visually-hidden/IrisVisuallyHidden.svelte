<script lang="ts">
  import { mergeStyle } from '../../internal/style'

  const SR_ONLY =
    'position: absolute; width: 1px; height: 1px; padding: 0; margin: calc(var(--iris-space-xxs, 4px) / -4); overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0'

  let { style, children, ...rest } = $props()
</script>

<span {...rest} data-iris-visually-hidden style={mergeStyle(SR_ONLY, style)}>
  {@render children?.()}
</span>

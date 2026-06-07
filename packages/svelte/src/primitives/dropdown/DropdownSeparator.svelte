<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'
  import type { IrisDropdownSeparatorProps } from './types'

  let { style, ...rest }: IrisDropdownSeparatorProps = $props()

  const base = styleToString({ height: '1px', background: 'var(--iris-border)', margin: '4px 0' })
</script>

<div {...rest} role="separator" data-iris-dropdown-separator style={mergeStyle(base, style)}></div>

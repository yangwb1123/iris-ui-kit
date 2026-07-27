<script lang="ts" module>
  export type IrisResizerHandle = import('./types').IrisResizerHandle
  export type IrisResizerSize = import('./types').IrisResizerSize
</script>

<script lang="ts">
  import IrisResizerHandleView from './IrisResizerHandle.svelte'
  import type { IrisResizerHandle as ResizerHandle, IrisResizerSize as ResizerSize } from './types'

  const ALL_HANDLES: ResizerHandle[] = [
    'top',
    'right',
    'bottom',
    'left',
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ]

  const HANDLE_CURSORS: Record<ResizerHandle, string> = {
    top: 'ns-resize',
    right: 'ew-resize',
    bottom: 'ns-resize',
    left: 'ew-resize',
    'top-left': 'nwse-resize',
    'top-right': 'nesw-resize',
    'bottom-left': 'nesw-resize',
    'bottom-right': 'nwse-resize',
  }

  function handlePosition(handle: ResizerHandle): string {
    const t = handle.includes('top')
    const b = handle.includes('bottom')
    const l = handle.includes('left')
    const r = handle.includes('right')
    const isCorner = (t || b) && (l || r)
    const parts = ['position: absolute']
    if (t) parts.push('top: -4px')
    if (b) parts.push('bottom: -4px')
    if (l) parts.push('left: -4px')
    if (r) parts.push('right: -4px')
    if (isCorner) {
      parts.push('width: 12px')
      parts.push('height: 12px')
    } else if (t || b) {
      parts.push('left: 0')
      parts.push('right: 0')
      parts.push('height: 8px')
    } else {
      parts.push('top: 0')
      parts.push('bottom: 0')
      parts.push('width: 8px')
    }
    parts.push(`cursor: ${HANDLE_CURSORS[handle]}`)
    return parts.join('; ')
  }

  interface Props {
    value: ResizerSize
    handles?: ResizerHandle[]
    minWidth?: number
    minHeight?: number
    maxWidth?: number
    maxHeight?: number
    disabled?: boolean
    keepAspect?: boolean
    onValueChange?: (size: ResizerSize) => void
    onResizeStart?: (size: ResizerSize) => void
    onResizeEnd?: (size: ResizerSize) => void
    children?: import('svelte').Snippet
    style?: string
    [key: string]: unknown
  }

  let {
    value,
    handles = ALL_HANDLES,
    minWidth = 40,
    minHeight = 40,
    maxWidth = Infinity,
    maxHeight = Infinity,
    disabled = false,
    keepAspect = false,
    onValueChange,
    onResizeStart,
    onResizeEnd,
    children,
    style,
    ...rest
  }: Props = $props()
</script>

<div
  {...rest}
  data-iris-resizer
  data-state={disabled ? 'disabled' : 'idle'}
  style="position: relative; display: inline-block; width: {value.width}px; height: {value.height}px;{style
    ? ' ' + style
    : ''}"
>
  {@render children?.()}
  {#each handles as handle (handle)}
    <IrisResizerHandleView
      {handle}
      {value}
      {minWidth}
      {minHeight}
      {maxWidth}
      {maxHeight}
      {disabled}
      {keepAspect}
      positionStyle={handlePosition(handle)}
      {onValueChange}
      {onResizeStart}
      {onResizeEnd}
    />
  {/each}
</div>

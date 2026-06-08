<script lang="ts">
  import { useDrag } from '../splitter/useDrag.svelte'

  export type IrisResizerHandle =
    | 'top' | 'right' | 'bottom' | 'left'
    | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

  export interface IrisResizerSize {
    width: number
    height: number
  }

  const ALL_HANDLES: IrisResizerHandle[] = [
    'top', 'right', 'bottom', 'left',
    'top-left', 'top-right', 'bottom-left', 'bottom-right',
  ]

  const HANDLE_CURSORS: Record<IrisResizerHandle, string> = {
    top: 'ns-resize', right: 'ew-resize', bottom: 'ns-resize', left: 'ew-resize',
    'top-left': 'nwse-resize', 'top-right': 'nesw-resize',
    'bottom-left': 'nesw-resize', 'bottom-right': 'nwse-resize',
  }

  function handlePosition(handle: IrisResizerHandle): string {
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
    if (isCorner) { parts.push('width: 12px'); parts.push('height: 12px') }
    else if (t || b) { parts.push('left: 0'); parts.push('right: 0'); parts.push('height: 8px') }
    else { parts.push('top: 0'); parts.push('bottom: 0'); parts.push('width: 8px') }
    parts.push(`cursor: ${HANDLE_CURSORS[handle]}`)
    return parts.join('; ')
  }

  interface Props {
    value: IrisResizerSize
    handles?: IrisResizerHandle[]
    minWidth?: number
    minHeight?: number
    maxWidth?: number
    maxHeight?: number
    disabled?: boolean
    keepAspect?: boolean
    onValueChange?: (size: IrisResizerSize) => void
    onResizeStart?: (size: IrisResizerSize) => void
    onResizeEnd?: (size: IrisResizerSize) => void
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

  // Per-handle element refs stored as reactive state map
  const handleEls = $state<Record<string, HTMLElement | undefined>>({})

  // Wire drag for each handle using $effect per handle
  handles.forEach((handle) => {
    let startSize: IrisResizerSize = { width: 0, height: 0 }
    let aspect = 1

    useDrag({
      handle: () => handleEls[handle],
      disabled: () => disabled,
      onStart: () => {
        startSize = { ...value }
        aspect = startSize.width / Math.max(1, startSize.height)
        onResizeStart?.(startSize)
      },
      onDrag: ({ dx, dy }) => {
        const t = handle.includes('top')
        const b = handle.includes('bottom')
        const l = handle.includes('left')
        const r = handle.includes('right')
        let nextW = startSize.width
        let nextH = startSize.height
        if (r) nextW = startSize.width + dx
        if (l) nextW = startSize.width - dx
        if (b) nextH = startSize.height + dy
        if (t) nextH = startSize.height - dy
        if (keepAspect && (t || b) && (l || r)) nextH = nextW / aspect
        nextW = Math.max(minWidth, Math.min(maxWidth, nextW))
        nextH = Math.max(minHeight, Math.min(maxHeight, nextH))
        onValueChange?.({ width: nextW, height: nextH })
      },
      onEnd: () => { onResizeEnd?.({ ...value }) },
    })
  })

  function registerHandle(node: HTMLElement, handle: IrisResizerHandle): { destroy: () => void } {
    handleEls[handle] = node
    return { destroy: () => { handleEls[handle] = undefined } }
  }
</script>

<div
  {...rest}
  data-iris-resizer
  data-state={disabled ? 'disabled' : 'idle'}
  style="position: relative; display: inline-block; width: {value.width}px; height: {value.height}px;{style ? ' ' + style : ''}"
>
  {@render children?.()}
  {#each handles as handle}
    <div
      use:registerHandle={handle}
      data-iris-resizer-handle={handle}
      style="{handlePosition(handle)}; touch-action: none; background: transparent; z-index: 1"
    ></div>
  {/each}
</div>

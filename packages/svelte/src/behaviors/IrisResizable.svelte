<script lang="ts">
  import type { Snippet } from 'svelte'
  import { useI18n } from '../i18n'

  export type IrisResizableHandle =
    | 'top'
    | 'right'
    | 'bottom'
    | 'left'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
  export interface IrisResizableSize {
    width: number
    height: number
  }

  const CURSORS: Record<IrisResizableHandle, string> = {
    top: 'ns-resize',
    right: 'ew-resize',
    bottom: 'ns-resize',
    left: 'ew-resize',
    'top-left': 'nwse-resize',
    'top-right': 'nesw-resize',
    'bottom-left': 'nesw-resize',
    'bottom-right': 'nwse-resize',
  }

  interface Props {
    size?: IrisResizableSize
    defaultSize?: IrisResizableSize
    handles?: IrisResizableHandle[]
    minWidth?: number
    maxWidth?: number
    minHeight?: number
    maxHeight?: number
    disabled?: boolean
    onSizeChange?: (size: IrisResizableSize) => void
    onResizeStart?: (size: IrisResizableSize) => void
    onResizeEnd?: (size: IrisResizableSize) => void
    children?: Snippet
  }

  let {
    size: sizeProp,
    defaultSize = { width: 200, height: 100 },
    handles = ['right', 'bottom', 'bottom-right'],
    minWidth = 40,
    maxWidth,
    minHeight = 40,
    maxHeight,
    disabled = false,
    onSizeChange,
    onResizeStart,
    onResizeEnd,
    children,
  }: Props = $props()

  const { t } = useI18n()

  const isControlled = $derived(sizeProp !== undefined)
  // svelte-ignore state_referenced_locally
  let internal = $state<IrisResizableSize>({ ...defaultSize })
  const size = $derived(isControlled ? (sizeProp as IrisResizableSize) : internal)

  function clamp(v: number, min: number, max?: number): number {
    if (v < min) return min
    if (max !== undefined && v > max) return max
    return v
  }

  function startResize(e: MouseEvent, handle: IrisResizableHandle) {
    if (disabled) return
    e.preventDefault()
    const startW = size.width
    const startH = size.height
    const startX = e.clientX
    const startY = e.clientY

    onResizeStart?.(size)

    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - startX
      const dy = me.clientY - startY
      let w = startW
      let h = startH
      if (handle.includes('right')) w = clamp(startW + dx, minWidth, maxWidth)
      if (handle.includes('left')) w = clamp(startW - dx, minWidth, maxWidth)
      if (handle.includes('bottom')) h = clamp(startH + dy, minHeight, maxHeight)
      if (handle.includes('top')) h = clamp(startH - dy, minHeight, maxHeight)
      const next = { width: w, height: h }
      if (!isControlled) internal = next
      onSizeChange?.(next)
    }

    const onUp = (_me: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      onResizeEnd?.(size)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function resizeByKeyboard(event: KeyboardEvent, handle: IrisResizableHandle): void {
    if (disabled) return
    const step = event.shiftKey ? 1 : 10
    let dx = 0
    let dy = 0
    if (event.key === 'ArrowLeft') dx = -step
    else if (event.key === 'ArrowRight') dx = step
    else if (event.key === 'ArrowUp') dy = -step
    else if (event.key === 'ArrowDown') dy = step
    else return
    event.preventDefault()
    let width = size.width
    let height = size.height
    if (handle.includes('right')) width = clamp(size.width + dx, minWidth, maxWidth)
    if (handle.includes('left')) width = clamp(size.width - dx, minWidth, maxWidth)
    if (handle.includes('bottom')) height = clamp(size.height + dy, minHeight, maxHeight)
    if (handle.includes('top')) height = clamp(size.height - dy, minHeight, maxHeight)
    const next = { width, height }
    onResizeStart?.(size)
    if (!isControlled) internal = next
    onSizeChange?.(next)
    onResizeEnd?.(next)
  }

  function handleStyle(h: IrisResizableHandle): string {
    const t = h.includes('top')
    const b = h.includes('bottom')
    const l = h.includes('left')
    const r = h.includes('right')
    const isCorner = (t || b) && (l || r)
    const parts: string[] = ['position:absolute;z-index:10;', `cursor:${CURSORS[h]};`]
    if (t) parts.push('top:-4px;')
    if (b) parts.push('bottom:-4px;')
    if (l) parts.push('left:-4px;')
    if (r) parts.push('right:-4px;')
    if (isCorner) {
      parts.push('width:12px;height:12px;')
    } else if (t || b) {
      parts.push('left:0;right:0;height:8px;')
    } else {
      parts.push('top:0;bottom:0;width:8px;')
    }
    return parts.join('')
  }
</script>

<div
  data-iris-resizable
  data-disabled={disabled ? '' : undefined}
  style:position="relative"
  style:width={`${size.width}px`}
  style:height={`${size.height}px`}
>
  {@render children?.()}

  {#each handles as handle (handle)}
    <button
      type="button"
      disabled={disabled || undefined}
      aria-label={t('resizer.handle', { handle })}
      data-iris-resizable-handle={handle}
      onmousedown={(e) => startResize(e, handle)}
      onkeydown={(e) => resizeByKeyboard(e, handle)}
      style="{handleStyle(handle)} border: 0; padding: 0; background: transparent"
    ></button>
  {/each}
</div>

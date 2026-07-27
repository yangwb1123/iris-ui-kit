<script lang="ts">
  import { useDrag } from '../drag/useDrag.svelte'
  import { useI18n } from '../../i18n'
  import type { IrisResizerHandle, IrisResizerSize } from './types'

  interface Props {
    handle: IrisResizerHandle
    value: IrisResizerSize
    minWidth: number
    minHeight: number
    maxWidth: number
    maxHeight: number
    disabled: boolean
    keepAspect: boolean
    positionStyle: string
    onValueChange?: (size: IrisResizerSize) => void
    onResizeStart?: (size: IrisResizerSize) => void
    onResizeEnd?: (size: IrisResizerSize) => void
  }

  let {
    handle,
    value,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    disabled,
    keepAspect,
    positionStyle,
    onValueChange,
    onResizeStart,
    onResizeEnd,
  }: Props = $props()

  const { t } = useI18n()

  let handleEl = $state<HTMLElement | undefined>(undefined)
  let startSize: IrisResizerSize = { width: 0, height: 0 }
  let lastSize: IrisResizerSize = { width: 0, height: 0 }
  let aspect = 1

  function resizeFrom(base: IrisResizerSize, dx: number, dy: number): IrisResizerSize {
    const top = handle.includes('top')
    const bottom = handle.includes('bottom')
    const left = handle.includes('left')
    const right = handle.includes('right')
    let width = base.width
    let height = base.height
    if (right) width = base.width + dx
    if (left) width = base.width - dx
    if (bottom) height = base.height + dy
    if (top) height = base.height - dy
    if (keepAspect && (top || bottom) && (left || right)) height = width / aspect
    return {
      width: Math.max(minWidth, Math.min(maxWidth, width)),
      height: Math.max(minHeight, Math.min(maxHeight, height)),
    }
  }

  useDrag({
    handle: () => handleEl,
    disabled: () => disabled,
    onStart: () => {
      startSize = { ...value }
      lastSize = startSize
      aspect = startSize.width / Math.max(1, startSize.height)
      onResizeStart?.(startSize)
    },
    onDrag: ({ dx, dy }) => {
      lastSize = resizeFrom(startSize, dx, dy)
      onValueChange?.(lastSize)
    },
    onEnd: () => {
      onResizeEnd?.(lastSize)
    },
  })

  function handleKeyDown(event: KeyboardEvent): void {
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
    const base = { ...value }
    aspect = base.width / Math.max(1, base.height)
    const next = resizeFrom(base, dx, dy)
    onResizeStart?.(base)
    onValueChange?.(next)
    onResizeEnd?.(next)
  }
</script>

<button
  bind:this={handleEl}
  type="button"
  disabled={disabled || undefined}
  aria-label={t('resizer.handle', { handle })}
  data-iris-resizer-handle={handle}
  onkeydown={handleKeyDown}
  style="{positionStyle}; touch-action: none; border: 0; padding: 0; background: transparent; z-index: 1"
></button>

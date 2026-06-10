<script lang="ts">
  import { useDrag } from '../drag/useDrag.svelte'

  export interface IrisDraggerPosition {
    x: number
    y: number
  }

  interface Props {
    value?: IrisDraggerPosition
    disabled?: boolean
    bounds?: { minX?: number; maxX?: number; minY?: number; maxY?: number }
    onValueChange?: (pos: IrisDraggerPosition) => void
    onDragStart?: (pos: IrisDraggerPosition) => void
    onDragEnd?: (pos: IrisDraggerPosition) => void
    children?: import('svelte').Snippet
    handle?: import('svelte').Snippet
    style?: string
    [key: string]: unknown
  }

  let {
    value = { x: 0, y: 0 },
    disabled = false,
    bounds = {},
    onValueChange,
    onDragStart,
    onDragEnd,
    children,
    handle,
    style,
    ...rest
  }: Props = $props()

  let rootEl = $state<HTMLElement | undefined>(undefined)
  let handleEl = $state<HTMLElement | undefined>(undefined)
  let dragging = $state(false)

  let startPos: IrisDraggerPosition = { x: 0, y: 0 }

  function clamp(pos: IrisDraggerPosition): IrisDraggerPosition {
    return {
      x: Math.max(bounds.minX ?? -Infinity, Math.min(bounds.maxX ?? Infinity, pos.x)),
      y: Math.max(bounds.minY ?? -Infinity, Math.min(bounds.maxY ?? Infinity, pos.y)),
    }
  }

  const effectiveHandle = $derived(handleEl ?? rootEl)

  useDrag({
    handle: () => effectiveHandle,
    disabled: () => disabled,
    onStart: () => {
      startPos = { ...value }
      dragging = true
      onDragStart?.(startPos)
    },
    onDrag: ({ dx, dy }) => {
      onValueChange?.(clamp({ x: startPos.x + dx, y: startPos.y + dy }))
    },
    onEnd: () => {
      dragging = false
      onDragEnd?.({ ...value })
    },
  })

  function setRoot(node: HTMLElement): { destroy: () => void } {
    rootEl = node
    return { destroy: () => { rootEl = undefined } }
  }
  function setHandle(node: HTMLElement): { destroy: () => void } {
    handleEl = node
    return { destroy: () => { handleEl = undefined } }
  }
</script>

<div
  {...rest}
  use:setRoot
  data-iris-dragger
  data-state={dragging ? 'dragging' : 'idle'}
  style="position: absolute; left: 0; top: 0; transform: translate3d({value.x}px, {value.y}px, 0); cursor: {handle ? 'default' : disabled ? 'not-allowed' : 'grab'}; touch-action: none;{style ? ' ' + style : ''}"
>
  {#if handle}
    <div
      use:setHandle
      data-iris-dragger-handle
      style="cursor: {disabled ? 'not-allowed' : 'grab'}; touch-action: none"
    >
      {@render handle()}
    </div>
  {/if}
  {@render children?.()}
</div>

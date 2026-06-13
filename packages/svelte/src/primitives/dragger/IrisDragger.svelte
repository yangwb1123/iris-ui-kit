<script lang="ts">
  import { useDrag } from '../drag/useDrag.svelte'

  export interface IrisDraggerPosition {
    x: number
    y: number
  }

  interface Props {
    value?: IrisDraggerPosition
    defaultValue?: IrisDraggerPosition
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
    value = undefined,
    defaultValue = { x: 0, y: 0 },
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

  // Controlled when `value` is supplied; otherwise self-manage the position from
  // defaultValue so an uncontrolled dragger actually moves without the parent
  // feeding `value` back (mirrors React/Solid; it renders its own transform).
  const isControlled = $derived(value !== undefined)
  // svelte-ignore state_referenced_locally
  let internal = $state<IrisDraggerPosition>(defaultValue)
  const current = $derived(isControlled ? (value as IrisDraggerPosition) : internal)

  function commit(pos: IrisDraggerPosition): void {
    if (!isControlled) internal = pos
    onValueChange?.(pos)
  }

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
      startPos = { ...current }
      dragging = true
      onDragStart?.(startPos)
    },
    onDrag: ({ dx, dy }) => {
      commit(clamp({ x: startPos.x + dx, y: startPos.y + dy }))
    },
    onEnd: () => {
      dragging = false
      onDragEnd?.({ ...current })
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
  style="position: absolute; left: 0; top: 0; transform: translate3d({current.x}px, {current.y}px, 0); cursor: {handle ? 'default' : disabled ? 'not-allowed' : 'grab'}; touch-action: none;{style ? ' ' + style : ''}"
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

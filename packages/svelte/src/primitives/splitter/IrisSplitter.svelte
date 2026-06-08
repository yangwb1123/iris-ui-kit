<script lang="ts">
  import { useDrag } from './useDrag.svelte'

  export type IrisSplitterOrientation = 'horizontal' | 'vertical'

  interface Props {
    orientation?: IrisSplitterOrientation
    value?: number
    onValueChange?: (value: number) => void
    minStart?: number
    minEnd?: number
    disabled?: boolean
    start?: import('svelte').Snippet
    end?: import('svelte').Snippet
    style?: string
    [key: string]: unknown
  }

  let {
    orientation = 'horizontal',
    value = 0.5,
    onValueChange,
    minStart = 80,
    minEnd = 80,
    disabled = false,
    start,
    end,
    style,
    ...rest
  }: Props = $props()

  let containerEl = $state<HTMLElement | undefined>(undefined)
  let handleEl = $state<HTMLElement | undefined>(undefined)
  let dragging = $state(false)

  const isHorizontal = $derived(orientation === 'horizontal')

  let startRatio = 0
  let totalSize = 0

  useDrag({
    handle: () => handleEl,
    disabled: () => disabled,
    onStart: () => {
      const container = containerEl
      if (!container) return false
      const rect = container.getBoundingClientRect()
      totalSize = isHorizontal ? rect.width : rect.height
      if (totalSize <= 0) return false
      startRatio = value
      dragging = true
      return true
    },
    onDrag: ({ dx, dy }) => {
      if (totalSize <= 0) return
      const delta = isHorizontal ? dx : dy
      const nextRatio = startRatio + delta / totalSize
      const minStartRatio = minStart / totalSize
      const maxRatio = 1 - minEnd / totalSize
      const clamped = Math.max(minStartRatio, Math.min(maxRatio, nextRatio))
      onValueChange?.(clamped)
    },
    onEnd: () => { dragging = false },
  })

  function setContainer(node: HTMLElement): { destroy: () => void } {
    containerEl = node
    return { destroy: () => { containerEl = undefined } }
  }
  function setHandle(node: HTMLElement): { destroy: () => void } {
    handleEl = node
    return { destroy: () => { handleEl = undefined } }
  }
</script>

<div
  {...rest}
  use:setContainer
  data-iris-splitter
  data-iris-splitter-orientation={orientation}
  data-state={dragging ? 'dragging' : 'idle'}
  style="display: flex; flex-direction: {isHorizontal ? 'row' : 'column'}; width: 100%; height: 100%; overflow: hidden;{style ? ' ' + style : ''}"
>
  <div
    data-iris-splitter-pane="start"
    style="flex: {value} 1 0; min-width: 0; min-height: 0; overflow: auto"
  >
    {@render start?.()}
  </div>
  <div
    use:setHandle
    data-iris-splitter-handle
    role="separator"
    aria-orientation={orientation}
    aria-valuenow={Math.round(value * 100)}
    aria-valuemin={0}
    aria-valuemax={100}
    tabindex={disabled ? -1 : 0}
    style="flex: 0 0 4px; background: {dragging ? 'var(--iris-primary)' : 'var(--iris-border)'}; cursor: {disabled ? 'not-allowed' : isHorizontal ? 'col-resize' : 'row-resize'}; transition: background-color 120ms ease; position: relative; touch-action: none"
  ></div>
  <div
    data-iris-splitter-pane="end"
    style="flex: {1 - value} 1 0; min-width: 0; min-height: 0; overflow: auto"
  >
    {@render end?.()}
  </div>
</div>

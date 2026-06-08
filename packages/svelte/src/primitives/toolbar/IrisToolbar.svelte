<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'

  type Orientation = 'horizontal' | 'vertical'

  interface Props {
    orientation?: Orientation
    ariaLabel?: string
    style?: string
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let {
    orientation = 'horizontal',
    ariaLabel,
    style,
    children,
    ...rest
  }: Props = $props()

  let rootEl = $state<HTMLElement | undefined>(undefined)

  const SELECTOR = 'button, [href], input, select, textarea, [tabindex]'

  function getItems(): HTMLElement[] {
    if (!rootEl) return []
    return (Array.from(rootEl.querySelectorAll(SELECTOR)) as HTMLElement[]).filter(
      (el) => !el.hasAttribute('disabled'),
    )
  }

  $effect(() => {
    // Initialize roving tabindex after mount
    const list = getItems()
    list.forEach((el, i) => { el.tabIndex = i === 0 ? 0 : -1 })
  })

  function handleKeyDown(e: KeyboardEvent) {
    const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
    const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
    const list = getItems()
    if (list.length === 0) return
    const cur = list.indexOf(document.activeElement as HTMLElement)
    let target: number
    if (e.key === nextKey) target = ((cur < 0 ? 0 : cur) + 1) % list.length
    else if (e.key === prevKey) target = ((cur < 0 ? 0 : cur) - 1 + list.length) % list.length
    else if (e.key === 'Home') target = 0
    else if (e.key === 'End') target = list.length - 1
    else return
    e.preventDefault()
    list.forEach((el, i) => { el.tabIndex = i === target ? 0 : -1 })
    list[target]?.focus()
  }

  const rootStyle = $derived(styleToString({
    display: 'inline-flex',
    'flex-direction': orientation === 'vertical' ? 'column' : 'row',
    'align-items': 'center',
    gap: '4px',
  }))
</script>

<div
  bind:this={rootEl}
  {...rest}
  role="toolbar"
  aria-orientation={orientation}
  aria-label={ariaLabel}
  data-iris-toolbar
  data-orientation={orientation}
  onkeydown={handleKeyDown}
  style={mergeStyle(rootStyle, style)}
>
  {@render children?.()}
</div>

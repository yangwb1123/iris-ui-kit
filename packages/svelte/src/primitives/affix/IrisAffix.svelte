<script lang="ts">
  import { mergeStyle } from '../../internal/style'

  interface Props {
    offsetTop?: number
    offsetBottom?: number
    target?: () => HTMLElement | Window | null
    style?: string
    children?: import('svelte').Snippet
    onchange?: (affixed: boolean) => void
    [key: string]: unknown
  }

  let { offsetTop, offsetBottom, target, style, children, onchange, ...rest }: Props = $props()

  let affixed = $state(false)
  let fixedStyle = $state<string | undefined>(undefined)
  let reserve = $state<number | undefined>(undefined)
  let placeholderEl = $state<HTMLElement | undefined>(undefined)
  let contentEl = $state<HTMLElement | undefined>(undefined)
  let isAffixed = false

  function resolve(): HTMLElement | Window {
    return (target ? target() : window) ?? window
  }

  function update() {
    const ph = placeholderEl
    if (!ph) return
    const useTop = offsetTop != null || offsetBottom == null
    const ot = offsetTop ?? 0
    const ob = offsetBottom ?? 0
    const rect = ph.getBoundingClientRect()
    const vh = window.innerHeight || 0
    const next = useTop ? rect.top <= ot : rect.bottom >= vh - ob
    if (next === isAffixed) return
    isAffixed = next
    const width = ph.offsetWidth
    if (next) {
      fixedStyle = `position: fixed; inset-inline-start: ${rect.left}px; width: ${width}px; z-index: 10; ${useTop ? `top: ${ot}px` : `bottom: ${ob}px`};`
      reserve = contentEl?.offsetHeight ?? 0
    } else {
      fixedStyle = undefined
      reserve = undefined
    }
    affixed = next
    onchange?.(next)
  }

  $effect(() => {
    const scrollEl = resolve()
    scrollEl.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    return () => {
      scrollEl.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  })
</script>

<div
  bind:this={placeholderEl}
  {...rest}
  data-iris-affix
  data-affixed={affixed ? 'true' : undefined}
  style={mergeStyle(affixed && reserve != null ? `height: ${reserve}px` : '', style)}
>
  <div bind:this={contentEl} data-iris-affix-content style={affixed ? fixedStyle : undefined}>
    {@render children?.()}
  </div>
</div>

<script lang="ts">
  import { getTabsContext } from './context'

  interface Props {
    style?: string
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { style, children, ...rest }: Props = $props()

  const ctx = getTabsContext()

  let el = $state<HTMLElement | undefined>(undefined)

  $effect(() => {
    ctx.setListEl(el ?? null)
    return () => ctx.setListEl(null)
  })
</script>

<div
  bind:this={el}
  {...rest}
  role="tablist"
  data-iris-tabs-list
  aria-orientation={ctx.orientation}
  style="display: flex; flex-direction: {ctx.orientation === 'horizontal' ? 'row' : 'column'}; border-bottom: {ctx.orientation === 'horizontal' ? '1px solid var(--iris-border)' : 'none'}; border-inline-end: {ctx.orientation === 'vertical' ? '1px solid var(--iris-border)' : 'none'}; {style ?? ''}"
>
  {@render children?.()}
</div>

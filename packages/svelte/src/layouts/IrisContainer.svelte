<script lang="ts">
  import type { Snippet } from 'svelte'

  export type IrisContainerMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | 'full' | string

  const WIDTH_MAP: Record<string, string> = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    full: '100%',
  }

  function resolveMaxWidth(input: IrisContainerMaxWidth): string {
    return WIDTH_MAP[input] ?? input
  }

  function resolvePadding(input: string | number): string {
    if (typeof input === 'number') return `${input}px`
    if (input === 'sm' || input === 'md' || input === 'lg') return `var(--iris-padding-${input})`
    return input
  }

  interface Props {
    maxWidth?: IrisContainerMaxWidth
    padding?: string | number
    center?: boolean
    style?: string
    class?: string
    children?: Snippet
  }

  let {
    maxWidth = 'lg',
    padding = 'md',
    center = true,
    style,
    class: className,
    children,
    ...rest
  }: Props = $props()

  const mw = $derived(resolveMaxWidth(maxWidth))
  const pad = $derived(resolvePadding(padding))
</script>

<div
  data-iris-container
  data-iris-container-max-width={maxWidth}
  style:width="100%"
  style:max-width={mw}
  style:padding={`0 ${pad}`}
  style:margin-inline-start={center ? 'auto' : undefined}
  style:margin-inline-end={center ? 'auto' : undefined}
  {style}
  class={className}
  {...rest}
>
  {@render children?.()}
</div>

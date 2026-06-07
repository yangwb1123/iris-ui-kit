<script lang="ts">
  import { installBreadcrumbStyles } from './styles'
  import type { IrisBreadcrumbProps } from './types'

  let { separator = '/', class: className, style, children }: IrisBreadcrumbProps = $props()

  $effect(() => installBreadcrumbStyles())

  const listStyle = $derived(`--iris-breadcrumb-sep: "${separator}"`)
</script>

<nav aria-label="Breadcrumb" data-iris-breadcrumb class={className} {style}>
  <ol data-iris-breadcrumb-list style={listStyle}>
    {@render children?.()}
  </ol>
</nav>

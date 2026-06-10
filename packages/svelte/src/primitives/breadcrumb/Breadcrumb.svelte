<script lang="ts">
  import { installBreadcrumbStyles } from './styles'
  import type { IrisBreadcrumbProps } from './types'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  let { separator = '/', class: className, style, children }: IrisBreadcrumbProps = $props()

  $effect(() => installBreadcrumbStyles())

  const listStyle = $derived(`--iris-breadcrumb-sep: "${separator}"`)
</script>

<nav aria-label={t('breadcrumb.label')} data-iris-breadcrumb class={className} {style}>
  <ol data-iris-breadcrumb-list style={listStyle}>
    {@render children?.()}
  </ol>
</nav>

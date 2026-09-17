<script lang="ts">
  import { installBreadcrumbStyles } from './styles'
  import type { IrisBreadcrumbProps } from './types'
  import { useI18n } from '../../i18n'

  const { locale: i18nLocale, t: translate } = useI18n()
  let reactiveT = $state(translate)
  $effect(() => {
    const activeLocale = $i18nLocale
    reactiveT = (key, params) => {
      void activeLocale
      return translate(key, params)
    }
  })

  let { separator = '/', class: className, style, children }: IrisBreadcrumbProps = $props()

  $effect(() => installBreadcrumbStyles())

  const listStyle = $derived(`--iris-breadcrumb-sep: "${separator}"`)
</script>

<nav aria-label={reactiveT('breadcrumb.label')} data-iris-breadcrumb class={className} {style}>
  <ol data-iris-breadcrumb-list style={listStyle}>
    {@render children?.()}
  </ol>
</nav>

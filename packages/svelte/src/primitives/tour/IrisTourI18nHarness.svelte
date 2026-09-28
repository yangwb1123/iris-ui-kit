<script lang="ts">
  import { createPlugin, type IrisPlugin } from '@iris-ui-kit/core'
  import IrisProvider from '../../provider/IrisProvider.svelte'
  import IrisTour from './IrisTour.svelte'

  type TourStep = {
    target?: () => HTMLElement | null
    title?: string
    description?: string
  }

  const tourLocalePlugin: IrisPlugin = createPlugin({
    name: 'tour-i18n-test',
    install(registry) {
      registry.registerMessages('zh-CN', {
        'tour.step': '第 {current} 步，共 {total} 步',
      })
    },
  })

  let {
    locale = 'en-US',
    steps = [],
    open = false,
  }: {
    locale?: string
    steps?: TourStep[]
    open?: boolean
  } = $props()
</script>

<IrisProvider {locale} plugins={[tourLocalePlugin]}>
  <IrisTour {steps} {open} />
</IrisProvider>

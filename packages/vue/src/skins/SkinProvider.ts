import {
  defineComponent,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  watch,
  type InjectionKey,
  type PropType,
  type Ref,
} from 'vue'
import { injectGlobalStyles } from '@iris-ui/theme'
import { applySkin, type ApplySkinResult, type ResolvedSkin, type SkinEngine } from '@iris-ui/skins'

export interface IrisSkinContext {
  engine: SkinEngine
  current: Ref<ResolvedSkin>
}

export const IrisSkinKey: InjectionKey<IrisSkinContext> = Symbol('IrisSkin')

/**
 * Renderless provider mirroring `<IrisThemeProvider>` for skins: subscribes to
 * the engine store, applies/reverts the resolved skin on the target element,
 * and provides the engine + current skin to descendants. Zero skin logic.
 */
export const SkinProvider = defineComponent({
  name: 'IrisSkinProvider',
  props: {
    engine: { type: Object as PropType<SkinEngine>, required: true },
    target: { type: Object as PropType<HTMLElement | null>, default: null },
  },
  setup(props, { slots }) {
    const current = ref(props.engine.current()) as Ref<ResolvedSkin>
    const unsubscribe = props.engine.subscribe((next) => {
      current.value = next
    })

    let applied: ApplySkinResult | null = null
    const targetEl = () => props.target ?? document.documentElement
    const apply = () => {
      applied?.revert()
      applied = applySkin(current.value, targetEl())
    }

    onMounted(() => {
      injectGlobalStyles()
      apply()
    })
    watch(current, () => {
      if (applied) apply()
    })
    onBeforeUnmount(() => {
      unsubscribe()
      applied?.revert()
      applied = null
    })

    provide(IrisSkinKey, { engine: props.engine, current })
    return () => slots.default?.()
  },
})

export function useSkinContext(): IrisSkinContext {
  const ctx = inject(IrisSkinKey)
  if (!ctx) throw new Error('[iris-ui] useSkin(): no <SkinProvider> ancestor found')
  return ctx
}

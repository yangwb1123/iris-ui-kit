import {
  createContext,
  createEffect,
  onCleanup,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js'
import { injectGlobalStyles } from '@iris-ui/theme'
import { applySkin, type ResolvedSkin, type SkinEngine } from '@iris-ui/skins'
import { useStore } from '../useStore'

interface IrisSkinContextValue {
  engine: SkinEngine
  current: Accessor<ResolvedSkin>
}

const IrisSkinContext = createContext<IrisSkinContextValue>()

export interface SkinProviderProps {
  engine: SkinEngine
  target?: HTMLElement | null
  children?: JSX.Element
}

/**
 * Renderless provider mirroring `<ThemeProvider>`: subscribes to the skin
 * engine's store, applies the resolved skin's CSS vars to `target` (or
 * `document.documentElement`), reverts on change/unmount. Zero skin logic — all
 * of it lives in `@iris-ui/skins`.
 */
export function SkinProvider(props: SkinProviderProps): JSX.Element {
  const current = useStore(props.engine.store)

  createEffect(() => {
    injectGlobalStyles()
    const el = props.target ?? document.documentElement
    const applied = applySkin(current(), el)
    onCleanup(() => applied.revert())
  })

  return (
    <IrisSkinContext.Provider value={{ engine: props.engine, current }}>
      {props.children}
    </IrisSkinContext.Provider>
  )
}

export function useSkinContext(): IrisSkinContextValue {
  const ctx = useContext(IrisSkinContext)
  if (!ctx) throw new Error('[iris-ui] useSkin(): no <SkinProvider> ancestor found')
  return ctx
}

/** Non-throwing read for skin-aware primitives that may render standalone. */
export function useSkinOptional(): Accessor<ResolvedSkin> | undefined {
  return useContext(IrisSkinContext)?.current
}

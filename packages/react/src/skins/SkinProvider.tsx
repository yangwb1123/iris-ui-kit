import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { injectGlobalStyles } from '@iris-ui/theme'
import { applySkin, type ApplySkinResult, type ResolvedSkin, type SkinEngine } from '@iris-ui/skins'
import { useStore } from '../useStore'

interface IrisSkinContextValue {
  engine: SkinEngine
  current: ResolvedSkin
}

const IrisSkinContext = createContext<IrisSkinContextValue | null>(null)

export interface SkinProviderProps {
  engine: SkinEngine
  target?: HTMLElement | null
  /** CSP nonce for the injected global stylesheet. */
  cspNonce?: string
  children?: ReactNode
}

/**
 * Renderless provider mirroring `<ThemeProvider>`: subscribes to the skin
 * engine's store, applies the resolved skin's CSS vars to `target` (or
 * `document.documentElement`), reverts on unmount. Zero skin logic — all of it
 * lives in `@iris-ui/skins`. Client boundary (tsup prepends `'use client'`).
 */
export function SkinProvider({ engine, target = null, cspNonce, children }: SkinProviderProps) {
  const current = useStore(engine.store)
  const appliedRef = useRef<ApplySkinResult | null>(null)

  useEffect(() => {
    injectGlobalStyles(cspNonce)
    const el = target ?? document.documentElement
    appliedRef.current?.revert()
    appliedRef.current = applySkin(current, el)
    return () => {
      appliedRef.current?.revert()
      appliedRef.current = null
    }
  }, [current, target])

  return <IrisSkinContext.Provider value={{ engine, current }}>{children}</IrisSkinContext.Provider>
}

export function useSkinContext(): IrisSkinContextValue {
  const ctx = useContext(IrisSkinContext)
  if (!ctx) throw new Error('[iris-ui] useSkin(): no <SkinProvider> ancestor found')
  return ctx
}

/** Non-throwing read for skin-aware primitives that may render standalone. */
export function useSkinOptional(): ResolvedSkin | undefined {
  return useContext(IrisSkinContext)?.current
}

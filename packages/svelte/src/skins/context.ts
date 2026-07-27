import type { Snippet } from 'svelte'
import type { Readable } from 'svelte/store'
import type { ResolvedSkin, SkinEngine } from '@iris-ui-kit/skins'

/** Context key for the Iris skin engine — a module-singleton Symbol. */
export const SKIN_KEY = Symbol('iris-ui:skin')

export interface IrisSkinContextValue {
  engine: SkinEngine
  /** Resolved skin as a Svelte store — `$skin` re-renders on change. */
  current: Readable<ResolvedSkin>
}

export interface SkinProviderProps {
  engine: SkinEngine
  /** Apply target; defaults to `document.documentElement`. */
  target?: HTMLElement | null
  /** CSP nonce for the injected global stylesheet. */
  cspNonce?: string
  children?: Snippet
}

import type { Codemod } from './types.js'
import { toastErrorToDanger } from './toast-error-to-danger.js'

export type { Codemod } from './types.js'

/**
 * Registry of available codemods. Add a new entry here whenever a public API
 * change ships — see packages/cli/README.md for the convention.
 */
export const CODEMODS: Codemod[] = [toastErrorToDanger]

export function findCodemod(name: string): Codemod | undefined {
  return CODEMODS.find((c) => c.name === name)
}

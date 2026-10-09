import type { Size } from './types'

export const DEFAULT_COMPONENT_SIZE: Size = 'md'

/** Pure precedence rule; adapters only supply their nearest reactive context. */
export function resolveComponentSize(
  explicit: Size | undefined,
  inherited: Size | null | undefined,
): Size {
  return explicit ?? inherited ?? DEFAULT_COMPONENT_SIZE
}

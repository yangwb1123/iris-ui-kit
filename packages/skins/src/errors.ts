export type SkinErrorCode =
  'validate' | 'cycle' | 'missing-parent' | 'incomplete' | 'load' | 'catalog'

export interface SkinError {
  code: SkinErrorCode
  message: string
  id?: string
  keys?: string[]
}

export function skinError(
  code: SkinErrorCode,
  message: string,
  extra?: { id?: string; keys?: string[] },
): SkinError {
  return { code, message, ...extra }
}

/**
 * Throwable wrapper carrying a typed `SkinError`. `resolveSkin` throws this
 * (callers always wrap); effectful units reject with it. Engines catch it and
 * surface `.error` via `errors()` — never letting it reach a store subscriber.
 */
export class SkinResolutionError extends Error {
  readonly error: SkinError
  constructor(error: SkinError) {
    super(error.message)
    this.name = 'SkinResolutionError'
    this.error = error
  }
}

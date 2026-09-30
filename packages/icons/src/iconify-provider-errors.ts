export type IconifyProviderErrorCode =
  | 'configuration'
  | 'http'
  | 'invalid-name'
  | 'invalid-response'
  | 'limit-exceeded'
  | 'missing-icon'
  | 'network'
  | 'unsafe-icon'

/** Error returned for invalid Iconify data, failed requests, or unsafe SVG content. */
export class IconifyProviderError extends Error {
  constructor(
    readonly code: IconifyProviderErrorCode,
    message: string,
  ) {
    super(`[iris-ui] ${message}`)
    this.name = 'IconifyProviderError'
  }
}

export function iconifyFail(code: IconifyProviderErrorCode, message: string): never {
  throw new IconifyProviderError(code, message)
}

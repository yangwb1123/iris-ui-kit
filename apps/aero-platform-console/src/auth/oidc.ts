import type { PlatformConfig } from '../config'

const pendingLifetimeMs = 10 * 60 * 1000
const maxTokenResponseBytes = 64 * 1024
const maxDiscoveryResponseBytes = 64 * 1024
const maxJwksResponseBytes = 256 * 1024
const clockSkewSeconds = 60

interface DiscoveryDocument {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
  end_session_endpoint?: string
  code_challenge_methods_supported?: string[]
  id_token_signing_alg_values_supported?: string[]
}

interface IDTokenHeader {
  alg?: string
  kid?: string
}

interface IDTokenClaims {
  iss?: string
  aud?: string | string[]
  azp?: string
  sub?: string
  nonce?: string
  exp?: number
  iat?: number
  nbf?: number
}

interface SigningJsonWebKey extends JsonWebKey {
  alg?: string
  kid?: string
  use?: string
}

interface JsonWebKeySet {
  keys?: SigningJsonWebKey[]
}

interface PendingAuthorization {
  version: 1
  state: string
  nonce: string
  verifier: string
  issuer: string
  redirectUri: string
  returnTo: string
  createdAt: number
}

interface TokenResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  id_token?: string
  scope?: string
  error?: string
  error_description?: string
}

export interface OidcSession {
  accessToken: string
  idToken?: string
  expiresAt: number
  returnTo: string
  scope: string[]
}

export interface OidcClientOptions {
  fetch?: typeof fetch
  storage?: Storage
  navigate?: (url: string) => void
  replaceUrl?: (url: string) => void
  now?: () => number
}

export class OidcError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OidcError'
  }
}

function base64Url(bytes: Uint8Array): string {
  let raw = ''
  for (const byte of bytes) raw += String.fromCharCode(byte)
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomValue(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

function normalizeIssuer(value: string): string {
  return value.replace(/\/+$/, '')
}

function requireSafeEndpoint(value: string, label: string): URL {
  let endpoint: URL
  try {
    endpoint = new URL(value)
  } catch {
    throw new OidcError(`${label} 不是有效 URL`)
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(endpoint.hostname)
  if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && loopback)) {
    throw new OidcError(`${label} 必须使用 HTTPS（仅回环地址允许 HTTP）`)
  }
  return endpoint
}

function cleanCallbackUrl(source: URL): string {
  return `${source.origin}${source.pathname}${source.hash}`
}

function decodeBase64Url(value: string, label: string): Uint8Array {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw new OidcError(`${label} 格式无效`)
  const padded = `${value.replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat((4 - (value.length % 4)) % 4)}`
  let raw: string
  try {
    raw = atob(padded)
  } catch {
    throw new OidcError(`${label} 格式无效`)
  }
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function decodeTokenPart<T>(value: string, label: string): T {
  try {
    const decoded: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(decodeBase64Url(value, label)),
    )
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new OidcError(`${label} 格式无效`)
    }
    return decoded as T
  } catch (reason) {
    if (reason instanceof OidcError) throw reason
    throw new OidcError(`${label} 格式无效`)
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

async function readBoundedJSON<T>(response: Response, maxBytes: number, label: string): Promise<T> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new OidcError(`${label} 响应过大`)
  }
  const reader = response.body?.getReader()
  if (!reader) throw new OidcError(`${label} 响应无效`)
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new OidcError(`${label} 响应过大`)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as T
  } catch {
    throw new OidcError(`${label} 响应无效`)
  }
}

function verificationAlgorithm(alg: string): AlgorithmIdentifier | RsaHashedImportParams {
  if (alg === 'EdDSA') return { name: 'Ed25519' }
  if (alg === 'RS256') return { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
  throw new OidcError(`Snaplink ID Token 使用了不支持的签名算法：${alg || 'missing'}`)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function hasPendingAuthorizationShape(value: unknown): value is PendingAuthorization {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const pending = value as Partial<PendingAuthorization>
  return (
    pending.version === 1 &&
    isNonEmptyString(pending.state) &&
    isNonEmptyString(pending.nonce) &&
    isNonEmptyString(pending.verifier) &&
    isNonEmptyString(pending.issuer) &&
    isNonEmptyString(pending.redirectUri) &&
    typeof pending.returnTo === 'string' &&
    Number.isFinite(pending.createdAt)
  )
}

function pendingMatchesClient(
  pending: PendingAuthorization,
  config: PlatformConfig,
  now: number,
): boolean {
  return (
    normalizeIssuer(pending.issuer) === normalizeIssuer(config.snaplinkIssuer) &&
    pending.redirectUri === config.redirectUri &&
    pending.createdAt <= now + clockSkewSeconds * 1000 &&
    now - pending.createdAt <= pendingLifetimeMs
  )
}

function tokenAudiences(value: IDTokenClaims['aud']): string[] {
  if (typeof value === 'string') return [value]
  if (!Array.isArray(value) || !value.every((audience) => typeof audience === 'string')) {
    return []
  }
  return value
}

function validateTokenAudience(claims: IDTokenClaims, clientId: string): void {
  const audiences = tokenAudiences(claims.aud)
  if (!audiences.includes(clientId)) {
    throw new OidcError('Snaplink ID Token audience 校验失败')
  }
  if ((audiences.length > 1 || claims.azp !== undefined) && claims.azp !== clientId) {
    throw new OidcError('Snaplink ID Token authorized party 校验失败')
  }
}

function validateTokenTimes(claims: IDTokenClaims, now: number): void {
  if (!Number.isFinite(claims.exp) || claims.exp! <= now - clockSkewSeconds) {
    throw new OidcError('Snaplink ID Token 已过期')
  }
  if (claims.nbf !== undefined && !Number.isFinite(claims.nbf)) {
    throw new OidcError('Snaplink ID Token 生效时间无效')
  }
  if (Number.isFinite(claims.nbf) && claims.nbf! > now + clockSkewSeconds) {
    throw new OidcError('Snaplink ID Token 尚未生效')
  }
  if (claims.iat !== undefined && !Number.isFinite(claims.iat)) {
    throw new OidcError('Snaplink ID Token 签发时间无效')
  }
  if (Number.isFinite(claims.iat) && claims.iat! > now + clockSkewSeconds) {
    throw new OidcError('Snaplink ID Token 签发时间无效')
  }
}

export class OidcClient {
  private readonly fetcher: typeof fetch
  private readonly storage: Storage
  private readonly navigate: (url: string) => void
  private readonly replaceUrl: (url: string) => void
  private readonly now: () => number
  private discovery?: Promise<DiscoveryDocument>
  private jwks?: Promise<SigningJsonWebKey[]>
  private exchange?: Promise<OidcSession>

  constructor(
    private readonly config: PlatformConfig,
    options: OidcClientOptions = {},
  ) {
    this.fetcher = options.fetch ?? window.fetch.bind(window)
    this.storage = options.storage ?? window.sessionStorage
    this.navigate = options.navigate ?? ((url) => window.location.assign(url))
    this.replaceUrl = options.replaceUrl ?? ((url) => window.history.replaceState(null, '', url))
    this.now = options.now ?? Date.now
    requireSafeEndpoint(config.snaplinkIssuer, 'Snaplink issuer')
    requireSafeEndpoint(config.redirectUri, 'OAuth redirect URI')
  }

  hasCallback(url = window.location.href): boolean {
    const params = new URL(url).searchParams
    return params.has('code') || params.has('error')
  }

  async prepareLogin(returnTo = '#/overview'): Promise<string> {
    const discovery = await this.getDiscovery()
    const verifier = randomValue()
    const pending: PendingAuthorization = {
      version: 1,
      state: randomValue(),
      nonce: randomValue(),
      verifier,
      issuer: discovery.issuer,
      redirectUri: this.config.redirectUri,
      returnTo,
      createdAt: this.now(),
    }
    this.storage.setItem(this.pendingKey(), JSON.stringify(pending))

    const authorization = requireSafeEndpoint(
      this.config.snaplinkHostedLoginUrl,
      'Snaplink hosted login URL',
    )
    authorization.searchParams.set('client_id', this.config.snaplinkClientId)
    authorization.searchParams.set('response_type', 'code')
    authorization.searchParams.set('redirect_uri', this.config.redirectUri)
    authorization.searchParams.set('scope', this.config.snaplinkScopes.join(' '))
    authorization.searchParams.set('resource', this.config.snaplinkResource)
    authorization.searchParams.set('state', pending.state)
    authorization.searchParams.set('nonce', pending.nonce)
    authorization.searchParams.set('code_challenge', await codeChallenge(verifier))
    authorization.searchParams.set('code_challenge_method', 'S256')
    return authorization.toString()
  }

  async beginLogin(returnTo?: string): Promise<void> {
    this.navigate(await this.prepareLogin(returnTo))
  }

  completeLogin(url = window.location.href): Promise<OidcSession> {
    this.exchange ??= this.exchangeCallback(new URL(url))
    return this.exchange
  }

  clear(): void {
    this.storage.removeItem(this.pendingKey())
    this.exchange = undefined
  }

  async logout(idToken?: string): Promise<void> {
    this.clear()
    const discovery = await this.getDiscovery()
    if (!discovery.end_session_endpoint) {
      throw new OidcError('Snaplink 未声明退出端点')
    }
    const endpoint = requireSafeEndpoint(discovery.end_session_endpoint, 'Snaplink logout endpoint')
    endpoint.searchParams.set('client_id', this.config.snaplinkClientId)
    endpoint.searchParams.set('post_logout_redirect_uri', this.config.redirectUri)
    if (idToken) endpoint.searchParams.set('id_token_hint', idToken)
    this.navigate(endpoint.toString())
  }

  private pendingKey(): string {
    return `aero-platform-console:pkce:${this.config.snaplinkClientId}`
  }

  private async getDiscovery(): Promise<DiscoveryDocument> {
    this.discovery ??= this.fetchDiscovery()
    return this.discovery
  }

  private async fetchDiscovery(): Promise<DiscoveryDocument> {
    const endpoint = `${normalizeIssuer(this.config.snaplinkIssuer)}/.well-known/openid-configuration`
    const response = await this.fetcher(endpoint, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    })
    if (!response.ok) throw new OidcError('无法读取 Snaplink OIDC 配置')
    const value = await readBoundedJSON<Partial<DiscoveryDocument>>(
      response,
      maxDiscoveryResponseBytes,
      'Snaplink discovery',
    )
    if (
      typeof value.issuer !== 'string' ||
      normalizeIssuer(value.issuer) !== normalizeIssuer(this.config.snaplinkIssuer) ||
      typeof value.authorization_endpoint !== 'string' ||
      typeof value.token_endpoint !== 'string' ||
      typeof value.jwks_uri !== 'string'
    ) {
      throw new OidcError('Snaplink OIDC 配置与运行配置不匹配')
    }
    if (
      !Array.isArray(value.code_challenge_methods_supported) ||
      !value.code_challenge_methods_supported.includes('S256')
    ) {
      throw new OidcError('Snaplink 未声明支持 PKCE S256')
    }
    if (
      this.config.snaplinkScopes.includes('openid') &&
      (!Array.isArray(value.id_token_signing_alg_values_supported) ||
        !value.id_token_signing_alg_values_supported.every(
          (algorithm) => typeof algorithm === 'string',
        ))
    ) {
      throw new OidcError('Snaplink 未声明 ID Token 签名算法')
    }
    requireSafeEndpoint(value.authorization_endpoint, 'Snaplink authorization endpoint')
    requireSafeEndpoint(value.token_endpoint, 'Snaplink token endpoint')
    requireSafeEndpoint(value.jwks_uri, 'Snaplink JWKS endpoint')
    return value as DiscoveryDocument
  }

  private readPending(): PendingAuthorization {
    const raw = this.storage.getItem(this.pendingKey())
    if (!raw) throw new OidcError('登录状态已失效，请重新登录')
    let pending: unknown
    try {
      pending = JSON.parse(raw) as unknown
    } catch {
      throw new OidcError('登录状态无效，请重新登录')
    }
    if (!hasPendingAuthorizationShape(pending)) {
      throw new OidcError('登录状态无效，请重新登录')
    }
    if (!pendingMatchesClient(pending, this.config, this.now())) {
      throw new OidcError('登录状态已过期，请重新登录')
    }
    return pending
  }

  private async exchangeCallback(callback: URL): Promise<OidcSession> {
    const pending = this.readPending()
    const code = this.validateCallback(callback, pending)
    this.storage.removeItem(this.pendingKey())
    const discovery = await this.getDiscovery()
    const token = await this.exchangeCode(discovery, pending, code)
    if (this.config.snaplinkScopes.includes('openid')) {
      if (!token.id_token) throw new OidcError('Snaplink 未返回 OpenID ID Token')
      await this.verifyIDToken(discovery, pending, token.id_token)
    }
    const tokenLifetime = Number(token.expires_in ?? 300)
    const lifetime = Number.isFinite(tokenLifetime) && tokenLifetime > 0 ? tokenLifetime : 300
    return {
      accessToken: token.access_token!,
      idToken: token.id_token,
      expiresAt: this.now() + lifetime * 1000,
      returnTo: pending.returnTo,
      scope: token.scope?.split(/\s+/).filter(Boolean) ?? this.config.snaplinkScopes,
    }
  }

  private validateCallback(callback: URL, pending: PendingAuthorization): string {
    this.replaceUrl(cleanCallbackUrl(callback))
    const redirect = new URL(pending.redirectUri)
    if (callback.origin !== redirect.origin || callback.pathname !== redirect.pathname) {
      return this.rejectCallback('登录回调地址校验失败')
    }
    const returnedState = callback.searchParams.get('state') ?? ''
    if (returnedState !== pending.state) return this.rejectCallback('登录 state 校验失败')
    const returnedIssuer = callback.searchParams.get('iss')
    if (returnedIssuer && normalizeIssuer(returnedIssuer) !== normalizeIssuer(pending.issuer)) {
      return this.rejectCallback('登录 issuer 校验失败')
    }
    const oauthError = callback.searchParams.get('error')
    if (oauthError) {
      return this.rejectCallback(callback.searchParams.get('error_description') ?? oauthError)
    }
    const code = callback.searchParams.get('code')
    if (!code) return this.rejectCallback('Snaplink 未返回授权码')
    return code
  }

  private rejectCallback(message: string): never {
    this.storage.removeItem(this.pendingKey())
    throw new OidcError(message)
  }

  private async exchangeCode(
    discovery: DiscoveryDocument,
    pending: PendingAuthorization,
    code: string,
  ): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.config.snaplinkClientId,
      redirect_uri: pending.redirectUri,
      code_verifier: pending.verifier,
      resource: this.config.snaplinkResource,
    })
    const response = await this.fetcher(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      credentials: 'omit',
    })
    return this.readTokenResponse(response)
  }

  private async verifyIDToken(
    discovery: DiscoveryDocument,
    pending: PendingAuthorization,
    token: string,
  ): Promise<void> {
    const parts = token.split('.')
    if (parts.length !== 3) throw new OidcError('Snaplink ID Token 格式无效')
    const header = decodeTokenPart<IDTokenHeader>(parts[0], 'Snaplink ID Token header')
    const claims = decodeTokenPart<IDTokenClaims>(parts[1], 'Snaplink ID Token claims')
    const alg = typeof header.alg === 'string' ? header.alg : ''
    const kid = typeof header.kid === 'string' ? header.kid : ''
    if (!kid) throw new OidcError('Snaplink ID Token 缺少签名密钥 ID')
    const supported = discovery.id_token_signing_alg_values_supported ?? []
    if (!supported.includes(alg))
      throw new OidcError('Snaplink ID Token 签名算法未被 discovery 声明')
    const algorithm = verificationAlgorithm(alg)
    const keys = await this.getJwks(discovery)
    const jwk = keys.find(
      (candidate) =>
        candidate.kid === kid &&
        (!candidate.alg || candidate.alg === alg) &&
        (!candidate.use || candidate.use === 'sig'),
    )
    if (!jwk) throw new OidcError('Snaplink ID Token 找不到匹配的签名密钥')

    let key: CryptoKey
    try {
      key = await crypto.subtle.importKey('jwk', jwk, algorithm, false, ['verify'])
    } catch {
      throw new OidcError('Snaplink ID Token 签名密钥无效')
    }
    const input = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    const signature = decodeBase64Url(parts[2], 'Snaplink ID Token signature')
    let valid = false
    try {
      valid = await crypto.subtle.verify(
        algorithm,
        key,
        toArrayBuffer(signature),
        toArrayBuffer(input),
      )
    } catch {
      valid = false
    }
    if (!valid) throw new OidcError('Snaplink ID Token 签名校验失败')
    this.validateIDTokenClaims(discovery, pending, claims)
  }

  private validateIDTokenClaims(
    discovery: DiscoveryDocument,
    pending: PendingAuthorization,
    claims: IDTokenClaims,
  ): void {
    if (
      typeof claims.iss !== 'string' ||
      normalizeIssuer(claims.iss) !== normalizeIssuer(discovery.issuer)
    ) {
      throw new OidcError('Snaplink ID Token issuer 校验失败')
    }
    validateTokenAudience(claims, this.config.snaplinkClientId)
    if (typeof claims.sub !== 'string' || !claims.sub.trim()) {
      throw new OidcError('Snaplink ID Token 缺少 subject')
    }
    if (claims.nonce !== pending.nonce) throw new OidcError('Snaplink ID Token nonce 校验失败')
    validateTokenTimes(claims, this.now() / 1000)
  }

  private getJwks(discovery: DiscoveryDocument): Promise<SigningJsonWebKey[]> {
    this.jwks ??= this.fetchJwks(discovery)
    return this.jwks
  }

  private async fetchJwks(discovery: DiscoveryDocument): Promise<SigningJsonWebKey[]> {
    const endpoint = requireSafeEndpoint(discovery.jwks_uri, 'Snaplink JWKS endpoint')
    const response = await this.fetcher(endpoint, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    })
    if (!response.ok) throw new OidcError('无法读取 Snaplink 签名密钥')
    const value = await readBoundedJSON<JsonWebKeySet>(
      response,
      maxJwksResponseBytes,
      'Snaplink JWKS',
    )
    if (!Array.isArray(value.keys) || value.keys.length === 0) {
      throw new OidcError('Snaplink JWKS 未包含签名密钥')
    }
    return value.keys
  }

  private async readTokenResponse(response: Response): Promise<TokenResponse> {
    const token = await readBoundedJSON<TokenResponse>(
      response,
      maxTokenResponseBytes,
      'Snaplink token',
    )
    if (!response.ok || token.error) {
      throw new OidcError(token.error_description ?? token.error ?? 'Snaplink 拒绝了授权码交换')
    }
    if (!token.access_token || token.token_type?.toLowerCase() !== 'bearer') {
      throw new OidcError('Snaplink 未返回有效 Bearer access token')
    }
    return token
  }
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlatformConfig } from '../config'
import { OidcClient } from './oidc'

const config: PlatformConfig = {
  snaplinkIssuer: 'https://identity.example.test',
  snaplinkHostedLoginUrl: 'https://identity.example.test/login/',
  snaplinkClientId: 'aero-account-console',
  snaplinkResource: 'aero-id',
  snaplinkScopes: ['openid', 'profile', 'account:read'],
  redirectUri: 'https://accounts.example.test/',
  aeroIdApiBase: 'https://accounts-api.example.test/v1',
}

const discovery = {
  issuer: config.snaplinkIssuer,
  authorization_endpoint: `${config.snaplinkIssuer}/auth/login`,
  token_endpoint: `${config.snaplinkIssuer}/token`,
  jwks_uri: `${config.snaplinkIssuer}/.well-known/jwks.json`,
  end_session_endpoint: `${config.snaplinkIssuer}/end_session`,
  code_challenge_methods_supported: ['S256'],
  id_token_signing_alg_values_supported: ['EdDSA'],
}

function base64Url(bytes: Uint8Array): string {
  let raw = ''
  for (const byte of bytes) raw += String.fromCharCode(byte)
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodeJSON(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)))
}

interface TestSigningKey extends JsonWebKey {
  alg: string
  kid: string
  use: string
}

async function createSigner(): Promise<{ keys: CryptoKeyPair; jwk: TestSigningKey }> {
  const keys = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  const publicKey = await crypto.subtle.exportKey('jwk', keys.publicKey)
  return {
    keys,
    jwk: { ...publicKey, alg: 'EdDSA', kid: 'test-key', use: 'sig' },
  }
}

async function signIDToken(
  privateKey: CryptoKey,
  claims: Record<string, unknown>,
): Promise<string> {
  const header = encodeJSON({ alg: 'EdDSA', kid: 'test-key', typ: 'JWT' })
  const payload = encodeJSON(claims)
  const input = new TextEncoder().encode(`${header}.${payload}`)
  const signature = await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, input)
  return `${header}.${payload}.${base64Url(new Uint8Array(signature))}`
}

describe('OidcClient', () => {
  beforeEach(() => sessionStorage.clear())

  it('builds an S256 authorization request without a client secret', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(discovery), { status: 200 }))
    const client = new OidcClient(config, { fetch: fetcher as typeof fetch })

    const target = new URL(await client.prepareLogin('#/profile'))

    expect(target.origin + target.pathname).toBe(config.snaplinkHostedLoginUrl)
    expect(target.searchParams.get('client_id')).toBe(config.snaplinkClientId)
    expect(target.searchParams.get('resource')).toBe('aero-id')
    expect(target.searchParams.get('code_challenge_method')).toBe('S256')
    expect(target.searchParams.get('code_challenge')).toHaveLength(43)
    expect(target.searchParams.has('client_secret')).toBe(false)
    expect([...Array(sessionStorage.length)].map((_, index) => sessionStorage.key(index))).toEqual([
      'aero-platform-console:pkce:aero-account-console',
    ])
  })

  it('exchanges a valid callback once and never persists the access token', async () => {
    const signer = await createSigner()
    let idToken = ''
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/.well-known/openid-configuration')) {
        return new Response(JSON.stringify(discovery), { status: 200 })
      }
      if (url === discovery.jwks_uri) {
        return new Response(JSON.stringify({ keys: [signer.jwk] }), { status: 200 })
      }
      expect(url).toBe(discovery.token_endpoint)
      expect(init?.headers).toMatchObject({ 'Content-Type': 'application/x-www-form-urlencoded' })
      const form = init?.body as URLSearchParams
      expect(form.get('client_secret')).toBeNull()
      expect(form.get('resource')).toBe('aero-id')
      return new Response(
        JSON.stringify({
          access_token: 'access-token-must-stay-in-memory',
          id_token: idToken,
          token_type: 'Bearer',
          expires_in: 300,
          scope: 'openid profile account:read',
        }),
        { status: 200 },
      )
    })
    const replaceUrl = vi.fn()
    const client = new OidcClient(config, {
      fetch: fetcher as typeof fetch,
      replaceUrl,
      now: () => 1_000,
    })
    const authorization = new URL(await client.prepareLogin('#/connections'))
    idToken = await signIDToken(signer.keys.privateKey, {
      iss: config.snaplinkIssuer,
      aud: config.snaplinkClientId,
      sub: 'admin',
      nonce: authorization.searchParams.get('nonce'),
      iat: 1,
      exp: 301,
    })
    const callback = new URL(config.redirectUri)
    callback.searchParams.set('code', 'authorization-code')
    callback.searchParams.set('state', authorization.searchParams.get('state')!)
    callback.searchParams.set('iss', config.snaplinkIssuer)

    const first = client.completeLogin(callback.toString())
    const second = client.completeLogin(callback.toString())
    const session = await first

    expect(second).toBe(first)
    expect(session.returnTo).toBe('#/connections')
    expect(session.accessToken).toBe('access-token-must-stay-in-memory')
    expect(session.idToken).toBe(idToken)
    expect(sessionStorage.length).toBe(0)
    expect(replaceUrl).toHaveBeenCalledWith(config.redirectUri)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('rejects a signed ID token whose nonce does not match the authorization request', async () => {
    const signer = await createSigner()
    let idToken = ''
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/.well-known/openid-configuration')) {
        return new Response(JSON.stringify(discovery), { status: 200 })
      }
      if (url === discovery.jwks_uri) {
        return new Response(JSON.stringify({ keys: [signer.jwk] }), { status: 200 })
      }
      return new Response(
        JSON.stringify({
          access_token: 'access-token',
          id_token: idToken,
          token_type: 'Bearer',
          expires_in: 300,
        }),
        { status: 200 },
      )
    })
    const client = new OidcClient(config, {
      fetch: fetcher as typeof fetch,
      replaceUrl: vi.fn(),
      now: () => 1_000,
    })
    const authorization = new URL(await client.prepareLogin())
    idToken = await signIDToken(signer.keys.privateKey, {
      iss: config.snaplinkIssuer,
      aud: config.snaplinkClientId,
      sub: 'admin',
      nonce: 'attacker-nonce',
      iat: 1,
      exp: 301,
    })

    await expect(
      client.completeLogin(
        `${config.redirectUri}?code=authorization-code&state=${authorization.searchParams.get('state')}`,
      ),
    ).rejects.toThrow('nonce 校验失败')
  })

  it('rejects an ID token with a tampered signature', async () => {
    const signer = await createSigner()
    let idToken = ''
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/.well-known/openid-configuration')) {
        return new Response(JSON.stringify(discovery), { status: 200 })
      }
      if (url === discovery.jwks_uri) {
        return new Response(JSON.stringify({ keys: [signer.jwk] }), { status: 200 })
      }
      return new Response(
        JSON.stringify({
          access_token: 'access-token',
          id_token: idToken,
          token_type: 'Bearer',
          expires_in: 300,
        }),
        { status: 200 },
      )
    })
    const client = new OidcClient(config, {
      fetch: fetcher as typeof fetch,
      replaceUrl: vi.fn(),
      now: () => 1_000,
    })
    const authorization = new URL(await client.prepareLogin())
    const signed = await signIDToken(signer.keys.privateKey, {
      iss: config.snaplinkIssuer,
      aud: config.snaplinkClientId,
      sub: 'admin',
      nonce: authorization.searchParams.get('nonce'),
      iat: 1,
      exp: 301,
    })
    const parts = signed.split('.')
    parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`
    idToken = parts.join('.')

    await expect(
      client.completeLogin(
        `${config.redirectUri}?code=authorization-code&state=${authorization.searchParams.get('state')}`,
      ),
    ).rejects.toThrow('签名校验失败')
  })

  it('rejects a state mismatch before calling the token endpoint', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(discovery), { status: 200 }))
    const client = new OidcClient(config, { fetch: fetcher as typeof fetch, replaceUrl: vi.fn() })
    await client.prepareLogin()

    await expect(
      client.completeLogin(`${config.redirectUri}?code=x&state=attacker-state`),
    ).rejects.toThrow('state 校验失败')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(sessionStorage.length).toBe(0)
  })

  it('navigates to the discovered RP-initiated logout endpoint', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(discovery), { status: 200 }))
    const navigate = vi.fn()
    const client = new OidcClient(config, { fetch: fetcher as typeof fetch, navigate })

    await client.logout('signed-id-token')

    const target = new URL(navigate.mock.calls[0][0])
    expect(target.origin + target.pathname).toBe(discovery.end_session_endpoint)
    expect(target.searchParams.get('client_id')).toBe(config.snaplinkClientId)
    expect(target.searchParams.get('id_token_hint')).toBe('signed-id-token')
    expect(target.searchParams.get('post_logout_redirect_uri')).toBe(config.redirectUri)
  })
})

// @vitest-environment jsdom

import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { CmsAuthClient, CmsSession, KeyValueStorage } from '@iris-ui-kit/cms-shared'
import { AuthProvider, useAuth, type AuthContextValue } from './auth'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

describe('React auth bridge', () => {
  let root: Root | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
  })

  it('mirrors async controller state without assigning a role in the adapter', async () => {
    let resolveLogin!: (session: CmsSession) => void
    const client: CmsAuthClient = {
      login: () =>
        new Promise((resolve) => {
          resolveLogin = resolve
        }),
    }
    let auth: AuthContextValue | undefined
    const Probe = () => {
      auth = useAuth()
      return <span>{auth.loading ? 'loading' : (auth.session?.role ?? 'anonymous')}</span>
    }
    const container = document.createElement('div')
    root = createRoot(container)

    act(() => {
      root?.render(
        <StrictMode>
          <AuthProvider client={client} storage={memoryStorage()}>
            <Probe />
          </AuthProvider>
        </StrictMode>,
      )
    })
    expect(container.textContent).toBe('anonymous')

    let loginPromise!: Promise<CmsSession | null>
    act(() => {
      loginPromise = auth!.login('api-user', 'pw')
    })
    expect(container.textContent).toBe('loading')

    await act(async () => {
      resolveLogin({ username: 'api-user', role: 'viewer' })
      await loginPromise
    })
    expect(container.textContent).toBe('viewer')
  })
})

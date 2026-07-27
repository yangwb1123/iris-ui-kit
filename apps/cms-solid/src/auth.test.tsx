// @vitest-environment jsdom

import { render } from 'solid-js/web'
import { afterEach, describe, expect, it } from 'vitest'
import type { CmsAuthClient, CmsSession, KeyValueStorage } from '@iris-ui-kit/cms-shared'
import { AuthProvider, useAuth, type AuthContextValue } from './auth'

function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

describe('Solid auth bridge', () => {
  let dispose: (() => void) | undefined

  afterEach(() => {
    dispose?.()
    dispose = undefined
  })

  it('projects shared async state through context getters', async () => {
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

    dispose = render(
      () => (
        <AuthProvider client={client} storage={memoryStorage()}>
          <Probe />
        </AuthProvider>
      ),
      container,
    )
    expect(container.textContent).toBe('anonymous')

    const login = auth!.login('api-user', 'pw')
    expect(container.textContent).toBe('loading')
    resolveLogin({ username: 'api-user', role: 'viewer' })
    await login
    expect(container.textContent).toBe('viewer')
  })
})

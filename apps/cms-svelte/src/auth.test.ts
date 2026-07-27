import { get } from 'svelte/store'
import { describe, expect, it } from 'vitest'
import type { CmsAuthClient, KeyValueStorage } from '@iris-ui-kit/cms-shared'
import { createAuthContext } from './auth'

const memoryStorage = (): KeyValueStorage => {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

describe('Svelte auth bridge', () => {
  it('exposes the shared controller as readable stores and async actions', async () => {
    const client: CmsAuthClient = {
      login: async () => ({ username: 'api-user', role: 'viewer' }),
    }
    const auth = createAuthContext({ client, storage: memoryStorage() })

    const login = auth.login('api-user', 'pw')
    expect(get(auth.loading)).toBe(true)
    await expect(login).resolves.toEqual({ username: 'api-user', role: 'viewer' })
    expect(get(auth.state)).toMatchObject({
      session: { username: 'api-user', role: 'viewer' },
      loading: false,
      error: null,
    })

    await auth.logout()
    expect(get(auth.session)).toBeNull()
    auth.destroy()
  })
})

import { describe, expect, it } from 'vitest'
import type { CmsAuthClient, KeyValueStorage } from '@iris-ui-kit/cms-shared'
import { createVueAuthBridge } from './auth'

const memoryStorage = (): KeyValueStorage => {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

describe('Vue auth bridge', () => {
  it('mirrors loading, session and logout from the shared controller', async () => {
    const client: CmsAuthClient = {
      login: async () => ({ username: 'api-user', role: 'viewer' }),
    }
    const auth = createVueAuthBridge({ client, storage: memoryStorage() })

    const login = auth.login('api-user', 'pw')
    expect(auth.state.value.loading).toBe(true)
    await expect(login).resolves.toEqual({ username: 'api-user', role: 'viewer' })
    expect(auth.state.value).toMatchObject({
      session: { username: 'api-user', role: 'viewer' },
      loading: false,
      error: null,
    })

    await auth.logout()
    expect(auth.state.value.session).toBeNull()
    auth.dispose()
  })
})

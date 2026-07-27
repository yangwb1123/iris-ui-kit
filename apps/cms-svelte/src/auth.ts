import { getContext } from 'svelte'
import { derived, readable, type Readable } from 'svelte/store'
import {
  createCmsAuthController,
  type CmsAuthControllerOptions,
  type CmsAuthState,
  type CmsSession,
} from '@iris-ui-kit/cms-shared'

export type { CmsAuthRole as Role, CmsSession as Session } from '@iris-ui-kit/cms-shared'

export const AUTH_KEY = Symbol('iris-cms-svelte-auth')

export interface AuthContextValue {
  state: Readable<CmsAuthState>
  session: Readable<CmsSession | null>
  loading: Readable<boolean>
  error: Readable<string | null>
  login(username: string, password: string): Promise<CmsSession | null>
  logout(): Promise<void>
  clearError(): void
  destroy(): void
}

/** Svelte readable-store bridge over the framework-neutral auth controller. */
export function createAuthContext(options: CmsAuthControllerOptions = {}): AuthContextValue {
  const controller = createCmsAuthController(options)
  const state = readable(controller.store.getState(), (set) => {
    set(controller.store.getState())
    return controller.store.subscribe(set)
  })

  return {
    state,
    session: derived(state, (current) => current.session),
    loading: derived(state, (current) => current.loading),
    error: derived(state, (current) => current.error),
    login: controller.login,
    logout: controller.logout,
    clearError: controller.clearError,
    destroy: controller.destroy,
  }
}

export function useAuth(): AuthContextValue {
  const context = getContext<AuthContextValue | undefined>(AUTH_KEY)
  if (!context) throw new Error('useAuth must be used within <AuthProvider>')
  return context
}

import * as React from 'react'
import {
  createCmsAuthController,
  type CmsAuthClient,
  type CmsAuthState,
  type CmsSession,
  type KeyValueStorage,
} from '@iris-ui-kit/cms-shared'

export type { CmsAuthRole as Role, CmsSession as Session } from '@iris-ui-kit/cms-shared'

export interface AuthContextValue extends CmsAuthState {
  login(username: string, password: string): Promise<CmsSession | null>
  logout(): Promise<void>
  clearError(): void
}

export interface AuthProviderProps {
  children: React.ReactNode
  /** Inject an HTTP-backed client in production; demos use the fixed local accounts. */
  client?: CmsAuthClient
  storage?: KeyValueStorage
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

/** React's thin reactivity bridge over the framework-neutral auth controller. */
export function AuthProvider({ children, client, storage }: AuthProviderProps): React.ReactElement {
  const controllerRef = React.useRef<ReturnType<typeof createCmsAuthController> | null>(null)
  if (controllerRef.current === null) {
    controllerRef.current = createCmsAuthController({ client, storage })
  }
  const controller = controllerRef.current
  const state = React.useSyncExternalStore(
    controller.store.subscribe,
    controller.store.getState,
    controller.store.getState,
  )
  const mountedRef = React.useRef(false)
  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // React StrictMode immediately replays effects in development. Deferring
      // teardown keeps that replay alive while still cancelling real unmounts.
      queueMicrotask(() => {
        if (!mountedRef.current) controller.destroy()
      })
    }
  }, [controller])

  const value = React.useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: controller.login,
      logout: controller.logout,
      clearError: controller.clearError,
    }),
    [controller, state],
  )

  return React.createElement(AuthContext.Provider, { value }, children)
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within <AuthProvider>')
  return context
}

import {
  createContext,
  createSignal,
  onCleanup,
  useContext,
  type Component,
  type JSX,
} from 'solid-js'
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
  children?: JSX.Element
  /** Inject an HTTP-backed client in production; demos use the fixed local accounts. */
  client?: CmsAuthClient
  storage?: KeyValueStorage
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/** Solid signal + subscription bridge over the framework-neutral controller. */
export const AuthProvider: Component<AuthProviderProps> = (props) => {
  const controller = createCmsAuthController({ client: props.client, storage: props.storage })
  const [state, setState] = createSignal(controller.store.getState())
  const unsubscribe = controller.store.subscribe(setState)
  onCleanup(() => {
    unsubscribe()
    controller.destroy()
  })

  const value: AuthContextValue = {
    get session() {
      return state().session
    },
    get loading() {
      return state().loading
    },
    get error() {
      return state().error
    },
    login: controller.login,
    logout: controller.logout,
    clearError: controller.clearError,
  }

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within <AuthProvider>')
  return context
}

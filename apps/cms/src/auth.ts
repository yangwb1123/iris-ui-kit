import { shallowRef, type ShallowRef } from 'vue'
import {
  createCmsAuthController,
  type CmsAuthController,
  type CmsAuthControllerOptions,
  type CmsAuthState,
  type CmsSession,
} from '@iris-ui-kit/cms-shared'

export type { CmsAuthRole as Role, CmsSession as Session } from '@iris-ui-kit/cms-shared'

export interface VueAuthBridge {
  state: ShallowRef<CmsAuthState>
  controller: CmsAuthController
  login(username: string, password: string): Promise<CmsSession | null>
  logout(): Promise<void>
  clearError(): void
  dispose(): void
}

/** Vue ref + subscription bridge; authentication logic remains in cms-shared. */
export function createVueAuthBridge(options: CmsAuthControllerOptions = {}): VueAuthBridge {
  const controller = createCmsAuthController(options)
  const state = shallowRef(controller.store.getState())
  const unsubscribe = controller.store.subscribe((next) => {
    state.value = next
  })

  return {
    state,
    controller,
    login: controller.login,
    logout: controller.logout,
    clearError: controller.clearError,
    dispose() {
      unsubscribe()
      controller.destroy()
    },
  }
}

const defaultAuth = createVueAuthBridge()

/** App-wide demo bridge; all four CMS apps use the same persisted session key. */
export const authState = defaultAuth.state
export const authStore = defaultAuth.controller.store
export const login = defaultAuth.login
export const logout = defaultAuth.logout
export const clearAuthError = defaultAuth.clearError

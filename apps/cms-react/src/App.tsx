import { SkinProvider, IrisProvider } from '@iris-ui-kit/react'
import { notificationsPlugin } from '@iris-ui-kit/plugin-notifications/react'
import { localeZhPlugin } from '@iris-ui-kit/plugin-locale-zh/core'
import { skinEngine } from './skin'
import { AuthProvider, useAuth } from './auth'
import { Shell } from './Shell'
import { LoginPage } from './pages/LoginPage'

/** Auth gate: unauthenticated → Login screen; authenticated → the CMS shell. */
function Gate() {
  const { session } = useAuth()
  return session ? <Shell /> : <LoginPage />
}

export function App() {
  return (
    <SkinProvider engine={skinEngine}>
      <IrisProvider plugins={[notificationsPlugin, localeZhPlugin]} locale="zh-CN">
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </IrisProvider>
    </SkinProvider>
  )
}

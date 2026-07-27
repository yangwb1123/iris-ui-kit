import type { JSX } from 'solid-js'
import { SkinProvider, IrisProvider } from '@iris-ui-kit/solid'
import { notificationsPlugin } from '@iris-ui-kit/plugin-notifications/core'
import { skinEngine } from './skin'
import { AuthProvider, useAuth } from './auth'
import { Shell } from './Shell'
import { LoginPage } from './pages/LoginPage'

/** Auth gate: unauthenticated → Login screen; authenticated → the CMS shell. */
function Gate(): JSX.Element {
  const { session } = useAuth()
  return session ? <Shell /> : <LoginPage />
}

export function App(): JSX.Element {
  return (
    <SkinProvider engine={skinEngine}>
      <IrisProvider plugins={[notificationsPlugin]}>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </IrisProvider>
    </SkinProvider>
  )
}

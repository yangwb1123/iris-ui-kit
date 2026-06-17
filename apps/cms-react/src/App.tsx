import { SkinProvider, IrisProvider } from '@iris-ui/react'
import { notificationsPlugin } from '@iris-ui/plugin-notifications/react'
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
      <IrisProvider plugins={[notificationsPlugin]}>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </IrisProvider>
    </SkinProvider>
  )
}

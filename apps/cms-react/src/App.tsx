import { SkinProvider } from '@iris-ui/react'
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
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SkinProvider>
  )
}

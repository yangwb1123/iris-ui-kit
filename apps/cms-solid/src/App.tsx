import type { JSX } from 'solid-js'
import { SkinProvider } from '@iris-ui/solid'
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
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SkinProvider>
  )
}

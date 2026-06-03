import { SkinProvider } from '@iris-ui/react'
import { skinEngine } from './skin'
import { Shell } from './Shell'

export function App() {
  return (
    <SkinProvider engine={skinEngine}>
      <Shell />
    </SkinProvider>
  )
}

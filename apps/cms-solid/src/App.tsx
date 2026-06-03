import type { JSX } from 'solid-js'
import { SkinProvider } from '@iris-ui/solid'
import { skinEngine } from './skin'
import { Shell } from './Shell'

export function App(): JSX.Element {
  return (
    <SkinProvider engine={skinEngine}>
      <Shell />
    </SkinProvider>
  )
}

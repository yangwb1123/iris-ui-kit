import { useState } from 'react'
import { IrisButton } from '@iris-ui/react'

const FALLBACK =
  'A placeholder page rendered inside IrisAdminLayout. Increment the counter, switch to another tab, then come back — the value survives because inactive tabs stay mounted (React keep-alive), keyed by the tab cache key.'

export function GenericPage({ title, description }: { title?: string; description?: string }) {
  // Local state to prove the keep-alive cache preserves a tab across switches.
  const [count, setCount] = useState(0)
  return (
    <section>
      <h1 className="page-title">{title}</h1>
      <p className="page-desc">{description ?? FALLBACK}</p>
      <IrisButton size="sm" variant="outline" onClick={() => setCount((c) => c + 1)}>
        Local counter: {count}
      </IrisButton>
    </section>
  )
}

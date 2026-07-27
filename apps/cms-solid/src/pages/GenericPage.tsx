import { createSignal, type JSX } from 'solid-js'
import { IrisButton } from '@iris-ui-kit/solid'

const FALLBACK =
  'A placeholder page rendered inside IrisAdminLayout. Increment the counter, switch to another tab, then come back — the value survives because inactive tabs stay mounted (keep-alive), keyed by the tab cache key.'

export function GenericPage(props: { title?: string; description?: string }): JSX.Element {
  // Local state to prove the keep-alive cache preserves a tab across switches.
  const [count, setCount] = createSignal(0)
  return (
    <section>
      <h1 class="page-title">{props.title}</h1>
      <p class="page-desc">{props.description ?? FALLBACK}</p>
      <IrisButton size="sm" variant="outline" onClick={() => setCount((c) => c + 1)}>
        Local counter: {count()}
      </IrisButton>
    </section>
  )
}

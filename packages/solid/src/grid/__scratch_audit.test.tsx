import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, afterEach } from 'vitest'
import { useGridColumns, useGridCore } from './index'

afterEach(cleanup)

describe('scratch columns sync', () => {
  it('C2 controlled visibility prop change reflects in the same render', () => {
    let setVisibility!: (v: Record<string, boolean> | undefined) => void
    let columns!: ReturnType<typeof useGridColumns>
    type Props = {
      visibility?: Record<string, boolean>
      defaultVisibility: Record<string, boolean>
    }
    const Harness = (props: Props) => {
      const core = useGridCore()
      columns = useGridColumns(core, props)
      return <output data-testid="v">{String(columns.state().visibility.age)}</output>
    }
    const Parent = () => {
      const [visibility, update] = createSignal<Record<string, boolean> | undefined>({ age: false })
      setVisibility = update
      return <Harness visibility={visibility()} defaultVisibility={{ age: false }} />
    }
    const view = render(() => <Parent />)
    expect(view.getByTestId('v').textContent).toBe('false')

    setVisibility({ age: true })
    // Same synchronous turn: React/Vue reflect the controlled prop immediately.
    // eslint-disable-next-line no-console
    console.log('synchronous after prop set:', view.getByTestId('v').textContent)
    expect(view.getByTestId('v').textContent).toBe('true')

    setVisibility(undefined)
    // eslint-disable-next-line no-console
    console.log('synchronous after control removed:', view.getByTestId('v').textContent)
    expect(view.getByTestId('v').textContent).toBe('false')
  })

  it('C3 controlled widths prop change reflects in the same render', () => {
    let setWidths!: (v: Record<string, number> | undefined) => void
    type Props = {
      widths?: Record<string, number>
      defaultWidths: Record<string, number>
    }
    const Harness = (props: Props) => {
      const core = useGridCore()
      const columns = useGridColumns(core, props)
      return <output data-testid="w">{String(columns.state().widths.name)}</output>
    }
    const Parent = () => {
      const [widths, update] = createSignal<Record<string, number> | undefined>({ name: 100 })
      setWidths = update
      return <Harness widths={widths()} defaultWidths={{ name: 100 }} />
    }
    const view = render(() => <Parent />)
    expect(view.getByTestId('w').textContent).toBe('100')
    setWidths({ name: 310 })
    // eslint-disable-next-line no-console
    console.log('widths synchronous after prop set:', view.getByTestId('w').textContent)
    expect(view.getByTestId('w').textContent).toBe('310')
  })
})

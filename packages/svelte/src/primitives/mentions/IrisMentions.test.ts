import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisMentions from './IrisMentions.svelte'

const options = [
  { label: 'Alice', value: 'alice' },
  { label: 'Bob', value: 'bob' },
]

describe('IrisMentions', () => {
  it('renders a textarea', () => {
    const { container } = render(IrisMentions, { props: { options } })
    expect(container.querySelector('[data-iris-mentions-textarea]')).toBeTruthy()
  })

  it('shows suggestion list on @ trigger', async () => {
    const { container } = render(IrisMentions, { props: { options, value: '' } })
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    ta.value = '@'
    ta.setSelectionRange(1, 1)
    await fireEvent.input(ta)
    flushSync()
    expect(container.querySelector('[data-iris-mentions-list]')).toBeTruthy()
  })

  it('does not show list without @', () => {
    const { container } = render(IrisMentions, { props: { options, value: 'hello' } })
    expect(container.querySelector('[data-iris-mentions-list]')).toBeFalsy()
  })
})

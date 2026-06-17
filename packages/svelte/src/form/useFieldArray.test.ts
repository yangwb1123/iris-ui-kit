import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import UseFieldArrayDemo from './UseFieldArrayDemo.svelte'

afterEach(cleanup)

describe('@iris-ui/svelte useFieldArray', () => {
  it('renders initial fields', () => {
    render(UseFieldArrayDemo)
    expect(screen.getByTestId('count').textContent).toBe('2')
  })

  it('push adds a field', () => {
    render(UseFieldArrayDemo)
    fireEvent.click(screen.getByTestId('push'))
    flushSync()
    expect(screen.getByTestId('count').textContent).toBe('3')
  })

  it('remove deletes a field', () => {
    render(UseFieldArrayDemo)
    fireEvent.click(screen.getByTestId('remove-0'))
    flushSync()
    expect(screen.getByTestId('count').textContent).toBe('1')
  })
})

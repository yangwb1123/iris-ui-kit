import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { fireEvent, screen } from '@testing-library/svelte'
import { createFormStore } from '@iris-ui-kit/core'
import FieldArrayHarness from './FieldArrayHarness.svelte'

afterEach(cleanup)

function makeForm() {
  return createFormStore<Record<string, unknown>>({ initialValues: { items: ['a', 'b'] } })
}

const texts = () => screen.getAllByTestId('row').map((el) => el.textContent)

describe('@iris-ui-kit/svelte useFieldArray', () => {
  it('renders the initial array', () => {
    const form = makeForm()
    render(FieldArrayHarness, { props: { form } })
    expect(texts()).toEqual(['a', 'b'])
  })

  it('push appends', () => {
    const form = makeForm()
    render(FieldArrayHarness, { props: { form } })
    fireEvent.click(screen.getByText('push'))
    flushSync()
    expect(texts()).toEqual(['a', 'b', 'c'])
  })

  it('remove deletes by index', () => {
    const form = makeForm()
    render(FieldArrayHarness, { props: { form } })
    fireEvent.click(screen.getByText('remove0'))
    flushSync()
    expect(texts()).toEqual(['b'])
  })

  it('insert places at index', () => {
    const form = makeForm()
    render(FieldArrayHarness, { props: { form } })
    fireEvent.click(screen.getByText('insert1'))
    flushSync()
    expect(texts()).toEqual(['a', 'x', 'b'])
  })

  it('move reorders', () => {
    const form = makeForm()
    render(FieldArrayHarness, { props: { form } })
    fireEvent.click(screen.getByText('push')) // a, b, c
    flushSync()
    fireEvent.click(screen.getByText('move')) // 0→2 → b, c, a
    flushSync()
    expect(texts()).toEqual(['b', 'c', 'a'])
  })
})

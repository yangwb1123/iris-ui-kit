import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { flushSync, tick } from 'svelte'
import type { FormStore } from '@iris-ui-kit/core'
import { createFormStore } from '@iris-ui-kit/core'
import UseFieldArrayDemo from './UseFieldArrayDemo.svelte'
import FieldArrayErrorCapture from './FieldArrayErrorCapture.svelte'
import type { UseFieldArrayReturn } from './useFieldArray'

afterEach(cleanup)

describe('@iris-ui-kit/svelte useFieldArray', () => {
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

  // Headline nested-array payoff: a row's per-element error FOLLOWS the row when
  // earlier rows are removed/reordered, because the hook routes through the core
  // arrayRemove/arrayMove helpers (which re-key error/touched/dirty), not a raw
  // setFieldValue. Discriminating: with the old direct-set impl the error would
  // stay stranded on items[2].name.
  it('per-row error follows the row across remove + move (core re-key)', async () => {
    const form = createFormStore({
      initialValues: { items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] },
    }) as unknown as FormStore<{ items: { name: string }[] }>

    let api!: UseFieldArrayReturn<{ name: string }>
    render(FieldArrayErrorCapture, {
      props: {
        form: form as never,
        onready: (a: UseFieldArrayReturn<{ name: string }>) => {
          api = a
        },
      },
    })
    await tick()

    // Error on the LAST row (index 2). Errors are keyed by canonical path
    // (numeric indices use bracket form, e.g. `items[2].name`).
    form.setFieldError('items[2].name' as never, 'too long')
    await tick()
    expect(form.getState().errors['items[2].name']).toBe('too long')

    // Remove the FIRST row → error rides row 2 down to row 1.
    api.remove(0)
    await tick()
    expect(form.getState().errors['items[1].name']).toBe('too long')
    expect(form.getState().errors['items[2].name']).toBeUndefined()

    // Move row 1 → row 0 → error rides along to row 0.
    api.move(1, 0)
    await tick()
    expect(form.getState().errors['items[0].name']).toBe('too long')
    expect(form.getState().errors['items[1].name']).toBeUndefined()
  })
})

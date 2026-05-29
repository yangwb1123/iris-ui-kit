import { afterEach, describe, expect, it } from 'vitest'
import * as React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IrisForm } from './Form'
import { useForm } from './useForm'
import { useFieldArray } from './useFieldArray'

afterEach(cleanup)

interface Values extends Record<string, unknown> {
  items: string[]
}

function Demo() {
  const form = useForm<Values>({ initialValues: { items: ['a', 'b'] } })
  return (
    <IrisForm form={form.form}>
      <Items />
    </IrisForm>
  )
}

function Items() {
  const arr = useFieldArray<string>('items')
  return (
    <div>
      <ul>
        {arr.fields.map((v, i) => (
          <li key={i} data-testid="row">
            {v}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => arr.push('c')}>
        push
      </button>
      <button type="button" onClick={() => arr.remove(0)}>
        remove0
      </button>
      <button type="button" onClick={() => arr.insert(1, 'x')}>
        insert1
      </button>
      <button type="button" onClick={() => arr.move(0, 2)}>
        move
      </button>
    </div>
  )
}

const texts = () => screen.getAllByTestId('row').map((el) => el.textContent)

describe('@iris-ui/react useFieldArray', () => {
  it('renders the initial array', () => {
    render(<Demo />)
    expect(texts()).toEqual(['a', 'b'])
  })

  it('push appends', () => {
    render(<Demo />)
    act(() => fireEvent.click(screen.getByText('push')))
    expect(texts()).toEqual(['a', 'b', 'c'])
  })

  it('remove deletes by index', () => {
    render(<Demo />)
    act(() => fireEvent.click(screen.getByText('remove0')))
    expect(texts()).toEqual(['b'])
  })

  it('insert places at index', () => {
    render(<Demo />)
    act(() => fireEvent.click(screen.getByText('insert1')))
    expect(texts()).toEqual(['a', 'x', 'b'])
  })

  it('move reorders', () => {
    render(<Demo />)
    act(() => fireEvent.click(screen.getByText('push'))) // a,b,c
    act(() => fireEvent.click(screen.getByText('move'))) // move 0→2 → b,c,a
    expect(texts()).toEqual(['b', 'c', 'a'])
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { renderHook } from '@solidjs/testing-library'
import { For } from 'solid-js'
import { IrisForm } from './IrisForm'
import { useForm } from './useForm'
import { useFieldArray } from './useFieldArray'

afterEach(cleanup)

interface Values extends Record<string, unknown> {
  items: string[]
}

function Demo() {
  const form = renderHook(() => useForm<Values>({ initialValues: { items: ['a', 'b'] } })).result
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
        <For each={arr.fields()}>{(v) => <li data-testid="row">{v}</li>}</For>
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

describe('@iris-ui/solid useFieldArray', () => {
  it('renders the initial array', () => {
    render(() => <Demo />)
    expect(texts()).toEqual(['a', 'b'])
  })

  it('push appends', () => {
    render(() => <Demo />)
    fireEvent.click(screen.getByText('push'))
    expect(texts()).toEqual(['a', 'b', 'c'])
  })

  it('remove deletes by index', () => {
    render(() => <Demo />)
    fireEvent.click(screen.getByText('remove0'))
    expect(texts()).toEqual(['b'])
  })

  it('insert places at index', () => {
    render(() => <Demo />)
    fireEvent.click(screen.getByText('insert1'))
    expect(texts()).toEqual(['a', 'x', 'b'])
  })

  it('move reorders', () => {
    render(() => <Demo />)
    fireEvent.click(screen.getByText('push')) // a,b,c
    fireEvent.click(screen.getByText('move')) // move 0→2 → b,c,a
    expect(texts()).toEqual(['b', 'c', 'a'])
  })
})

import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisForm } from './Form'
import { useForm } from './useForm'
import { useFieldArray } from './useFieldArray'

const Items = defineComponent({
  setup() {
    const arr = useFieldArray<string>('items')
    return () =>
      h('div', null, [
        h(
          'ul',
          null,
          arr.fields.value.map((v, i) => h('li', { class: 'row', key: i }, v)),
        ),
        h('button', { class: 'push', onClick: () => arr.push('c') }, 'push'),
        h('button', { class: 'remove0', onClick: () => arr.remove(0) }, 'remove0'),
        h('button', { class: 'insert1', onClick: () => arr.insert(1, 'x') }, 'insert1'),
        h('button', { class: 'move', onClick: () => arr.move(0, 2) }, 'move'),
      ])
  },
})

const Demo = defineComponent({
  setup() {
    const form = useForm<{ items: string[] }>({ initialValues: { items: ['a', 'b'] } })
    return () => h(IrisForm, { form: form.form }, { default: () => h(Items) })
  },
})

const texts = (w: ReturnType<typeof mount>) => w.findAll('.row').map((el) => el.text())

describe('@iris-ui-kit/vue useFieldArray', () => {
  it('renders the initial array', () => {
    expect(texts(mount(Demo))).toEqual(['a', 'b'])
  })

  it('push appends', async () => {
    const w = mount(Demo)
    await w.find('.push').trigger('click')
    expect(texts(w)).toEqual(['a', 'b', 'c'])
  })

  it('remove deletes by index', async () => {
    const w = mount(Demo)
    await w.find('.remove0').trigger('click')
    expect(texts(w)).toEqual(['b'])
  })

  it('insert places at index', async () => {
    const w = mount(Demo)
    await w.find('.insert1').trigger('click')
    expect(texts(w)).toEqual(['a', 'x', 'b'])
  })

  it('move reorders', async () => {
    const w = mount(Demo)
    await w.find('.push').trigger('click') // a,b,c
    await w.find('.move').trigger('click') // 0→2 → b,c,a
    expect(texts(w)).toEqual(['b', 'c', 'a'])
  })
})

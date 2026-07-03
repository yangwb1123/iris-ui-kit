import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisTransfer, type IrisTransferItem } from './Transfer'

const OPTIONS: IrisTransferItem[] = [
  { label: 'Apple', value: 'a' },
  { label: 'Banana', value: 'b' },
  { label: 'Cherry', value: 'c' },
  { label: 'Durian', value: 'd', disabled: true },
]

const panes = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-transfer-pane]')
const itemsIn = (pane: ReturnType<typeof panes>[number]) =>
  pane.findAll('[data-iris-transfer-item]')

describe('IrisTransfer', () => {
  it('splits options into available and selected panes', () => {
    const w = mount(IrisTransfer, { props: { options: OPTIONS, modelValue: ['b'] } })
    const p = panes(w)
    expect(itemsIn(p[0]).length).toBe(3)
    expect(itemsIn(p[1]).length).toBe(1)
  })

  it('moves a checked source item to the target', async () => {
    const w = mount(IrisTransfer, { props: { options: OPTIONS, modelValue: [] } })
    await itemsIn(panes(w)[0])[0].find('input').setValue(true)
    await w.find('[data-iris-transfer-to-target]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['a']])
  })

  it('moves a checked target item back to the source', async () => {
    const w = mount(IrisTransfer, { props: { options: OPTIONS, modelValue: ['a', 'b'] } })
    await itemsIn(panes(w)[1])[0].find('input').setValue(true)
    await w.find('[data-iris-transfer-to-source]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['b']])
  })

  it('disables move buttons when nothing is checked', () => {
    const w = mount(IrisTransfer, { props: { options: OPTIONS, modelValue: [] } })
    expect(w.find('[data-iris-transfer-to-target]').attributes('disabled')).toBeDefined()
  })

  it('filters a pane via search', async () => {
    const w = mount(IrisTransfer, { props: { options: OPTIONS, modelValue: [], searchable: true } })
    await panes(w)[0].find('[data-iris-transfer-search]').setValue('ban')
    expect(itemsIn(panes(w)[0]).length).toBe(1)
  })

  it('select-all moves every enabled item (disabled excluded)', async () => {
    const w = mount(IrisTransfer, { props: { options: OPTIONS, modelValue: [] } })
    await panes(w)[0].find('[data-iris-transfer-select-all]').setValue(true)
    await w.find('[data-iris-transfer-to-target]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['a', 'b', 'c']])
  })

  it('disabled items are not selectable', () => {
    const w = mount(IrisTransfer, { props: { options: OPTIONS, modelValue: [] } })
    const durian = itemsIn(panes(w)[0]).find((li) => li.attributes('data-value') === 'd')!
    expect(durian.find('input').attributes('disabled')).toBeDefined()
  })

  it('a11y: move buttons have accessible labels', () => {
    const w = mount(IrisTransfer, { props: { options: OPTIONS, modelValue: [] } })
    expect(w.find('[data-iris-transfer-to-target]').attributes('aria-label')).toBe(
      'Move to selected',
    )
    expect(w.find('[data-iris-transfer-to-source]').attributes('aria-label')).toBe(
      'Move to available',
    )
  })

  it('empty state renders no items', () => {
    const w = mount(IrisTransfer, { props: { options: [], modelValue: [] } })
    const p = panes(w)
    expect(itemsIn(p[0]).length).toBe(0)
    expect(itemsIn(p[1]).length).toBe(0)
  })

  it('onValueChange fires on move', async () => {
    const w = mount(IrisTransfer, { props: { options: OPTIONS, modelValue: ['a'] } })
    const targetPane = panes(w)[1]
    await targetPane.find('input').setValue(true)
    await w.find('[data-iris-transfer-to-source]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([[]])
  })

  it('whole-component disabled blocks all item checkboxes and move buttons', () => {
    const w = mount(IrisTransfer, {
      props: { options: OPTIONS, modelValue: ['a'], disabled: true },
    })
    expect(w.find('[data-iris-transfer-to-target]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-iris-transfer-to-source]').attributes('disabled')).toBeDefined()
    for (const li of itemsIn(panes(w)[0])) {
      expect(li.find('input').attributes('disabled')).toBeDefined()
    }
  })

  it('whole-component disabled ignores click attempts to move items', async () => {
    const w = mount(IrisTransfer, { props: { options: OPTIONS, modelValue: [], disabled: true } })
    await w.find('[data-iris-transfer-to-target]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})

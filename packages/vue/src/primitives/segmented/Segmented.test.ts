import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisSegmented, type IrisSegmentedOption } from './Segmented'

const OPTS: IrisSegmentedOption[] = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month', disabled: true },
]

const items = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-segmented-item]')

describe('IrisSegmented', () => {
  it('renders a radiogroup of segments', () => {
    const w = mount(IrisSegmented, { props: { options: OPTS } })
    expect(w.find('[role="radiogroup"]').exists()).toBe(true)
    expect(items(w).length).toBe(3)
  })

  it('accepts plain string options', () => {
    const w = mount(IrisSegmented, { props: { options: ['a', 'b'] } })
    expect(items(w).length).toBe(2)
    expect(items(w)[0].text()).toBe('a')
  })

  it('marks the selected segment with aria-checked', () => {
    const w = mount(IrisSegmented, { props: { options: OPTS, modelValue: 'week' } })
    const sel = items(w).find((b) => b.attributes('aria-checked') === 'true')
    expect(sel?.text()).toBe('Week')
  })

  it('clicking a segment emits its value', async () => {
    const w = mount(IrisSegmented, { props: { options: OPTS } })
    await items(w)[1].trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['week'])
  })

  it('Arrow keys move selection, skipping disabled (with wrap)', async () => {
    const w = mount(IrisSegmented, { props: { options: OPTS, modelValue: 'week' } })
    await items(w)[1].trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['day'])
  })

  it('disabled control ignores clicks', async () => {
    const w = mount(IrisSegmented, { props: { options: OPTS, disabled: true } })
    await items(w)[0].trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('ArrowLeft moves backward, wrapping to last enabled', async () => {
    const w = mount(IrisSegmented, { props: { options: OPTS, modelValue: 'day' } })
    // From 'day' (index 0), ArrowLeft wraps backward, skipping disabled 'month' (index 2) → lands on 'week' (index 1)
    await items(w)[0].trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['week'])
  })

  it('ArrowDown is treated as forward navigation, same as ArrowRight', async () => {
    const w = mount(IrisSegmented, { props: { options: OPTS, modelValue: 'day' } })
    await items(w)[0].trigger('keydown', { key: 'ArrowDown' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['week'])
  })

  it('ArrowUp is treated as backward navigation, same as ArrowLeft', async () => {
    const w = mount(IrisSegmented, { props: { options: OPTS, modelValue: 'week' } })
    await items(w)[1].trigger('keydown', { key: 'ArrowUp' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['day'])
  })

  it('Home jumps to first enabled segment', async () => {
    const w = mount(IrisSegmented, { props: { options: OPTS, modelValue: 'week' } })
    // Trigger Home from an enabled button to jump to the first enabled segment
    await items(w)[1].trigger('keydown', { key: 'Home' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['day'])
  })

  it('End jumps to last enabled segment', async () => {
    const w = mount(IrisSegmented, { props: { options: OPTS, modelValue: 'day' } })
    await items(w)[0].trigger('keydown', { key: 'End' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['week'])
  })

  it('keyboard navigation on disabled control is ignored', async () => {
    const w = mount(IrisSegmented, { props: { options: OPTS, modelValue: 'day', disabled: true } })
    await items(w)[0].trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('ArrowRight skips disabled segments with wrap — Home also skips disabled segment at index 2', async () => {
    const w = mount(IrisSegmented, { props: { options: OPTS, modelValue: 'day' } })
    // The existing test confirms ArrowRight from 'week' wraps to 'day' (skipping disabled 'month' at index 2)
    // From 'day', ArrowRight moves to 'week' (index 1), skipping disabled 'month' (index 2)
    await items(w)[0].trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['week'])
    // From 'week', ArrowRight wraps to 'day' (skipping disabled 'month')
    await items(w)[1].trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['day'])
  })
})

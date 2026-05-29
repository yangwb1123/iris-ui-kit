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
})

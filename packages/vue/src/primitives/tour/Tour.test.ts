import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisTour } from './Tour'

const STEPS = [{ title: 'A', description: 'da' }, { title: 'B' }, { title: 'C' }]

describe('IrisTour', () => {
  it('is hidden when open is false', () => {
    const w = mount(IrisTour, { props: { steps: STEPS, open: false } })
    expect(w.find('[data-iris-tour-card]').exists()).toBe(false)
  })

  it('shows the first step when open', () => {
    const w = mount(IrisTour, { props: { steps: STEPS, open: true } })
    expect(w.find('[data-iris-tour-title]').text()).toBe('A')
    expect(w.find('[data-iris-tour-indicator]').text()).toBe('Step 1 of 3')
  })

  it('Next advances and Prev goes back', async () => {
    const w = mount(IrisTour, { props: { steps: STEPS, open: true } })
    await w.find('[data-iris-tour-next]').trigger('click')
    expect(w.emitted('change')?.at(-1)).toEqual([1])
    expect(w.find('[data-iris-tour-title]').text()).toBe('B')
    await w.find('[data-iris-tour-prev]').trigger('click')
    expect(w.find('[data-iris-tour-title]').text()).toBe('A')
  })

  it('the last step finishes and requests close', async () => {
    const w = mount(IrisTour, { props: { steps: [{ title: 'Only' }], open: true } })
    expect(w.find('[data-iris-tour-next]').text()).toBe('Finish')
    await w.find('[data-iris-tour-next]').trigger('click')
    expect(w.emitted('finish')).toBeTruthy()
    expect(w.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('Skip requests close', async () => {
    const w = mount(IrisTour, { props: { steps: STEPS, open: true } })
    await w.find('[data-iris-tour-skip]').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
    expect(w.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('a11y: the card is a dialog', () => {
    const w = mount(IrisTour, { props: { steps: STEPS, open: true } })
    expect(w.find('[data-iris-tour-card]').attributes('role')).toBe('dialog')
  })
})

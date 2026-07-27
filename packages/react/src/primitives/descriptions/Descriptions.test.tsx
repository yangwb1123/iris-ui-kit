import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisDescriptions, type IrisDescriptionsItem } from './Descriptions'

afterEach(() => cleanup())

const ITEMS: IrisDescriptionsItem[] = [
  { label: 'Name', value: 'Ada' },
  { label: 'Role', value: 'Engineer' },
]

describe('@iris-ui-kit/react IrisDescriptions', () => {
  it('renders a <dl> with a dt/dd per item', () => {
    const { container } = render(<IrisDescriptions items={ITEMS} />)
    expect(container.querySelector('dl[data-iris-descriptions]')).not.toBeNull()
    expect(container.querySelectorAll('[data-iris-descriptions-label]').length).toBe(2)
    expect(container.querySelectorAll('[data-iris-descriptions-value]').length).toBe(2)
  })

  it('renders label and value text', () => {
    const { container } = render(<IrisDescriptions items={ITEMS} />)
    expect(container.querySelector('[data-iris-descriptions-label]')?.textContent).toBe('Name')
    expect(container.querySelector('[data-iris-descriptions-value]')?.textContent).toBe('Ada')
  })

  it('horizontal layout puts dt/dd directly in the dl (no wrapper)', () => {
    const { container } = render(<IrisDescriptions items={ITEMS} layout="horizontal" />)
    expect(container.querySelector('[data-iris-descriptions]')?.getAttribute('data-layout')).toBe(
      'horizontal',
    )
    expect(container.querySelector('[data-iris-descriptions-item]')).toBeNull()
  })

  it('vertical layout wraps each pair in an item', () => {
    const { container } = render(<IrisDescriptions items={ITEMS} layout="vertical" />)
    expect(container.querySelectorAll('[data-iris-descriptions-item]').length).toBe(2)
  })

  it('columns drive the grid template', () => {
    const { container } = render(<IrisDescriptions items={ITEMS} columns={2} />)
    const dl = container.querySelector('[data-iris-descriptions]') as HTMLElement
    expect(dl.style.gridTemplateColumns).toContain('repeat(2')
  })
})

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisDescriptions } from './IrisDescriptions'

afterEach(cleanup)

const items = [
  { label: 'Name', value: 'Ada Lovelace' },
  { label: 'Role', value: 'Engineer' },
]

describe('IrisDescriptions', () => {
  it('renders a dl element', () => {
    const { container } = render(() => <IrisDescriptions items={items} />)
    expect(container.querySelector('dl[data-iris-descriptions]')).not.toBeNull()
  })

  it('renders labels and values', () => {
    const { getByText } = render(() => <IrisDescriptions items={items} />)
    expect(getByText('Name')).toBeTruthy()
    expect(getByText('Ada Lovelace')).toBeTruthy()
    expect(getByText('Role')).toBeTruthy()
    expect(getByText('Engineer')).toBeTruthy()
  })

  it('renders vertical layout with wrapper divs', () => {
    const { container } = render(() => <IrisDescriptions items={items} layout="vertical" />)
    expect(container.querySelector('[data-iris-descriptions-item]')).not.toBeNull()
    expect(container.querySelector('[data-layout="vertical"]')).not.toBeNull()
  })

  it('renders empty list without crashing', () => {
    const { container } = render(() => <IrisDescriptions items={[]} />)
    expect(container.querySelector('dl')).not.toBeNull()
  })
})

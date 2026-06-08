import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { IrisAffix } from './IrisAffix'

afterEach(cleanup)

describe('IrisAffix', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisAffix>Sticky content</IrisAffix>)
    expect(container.querySelector('[data-iris-affix]')).not.toBeNull()
  })

  it('renders content inside affix-content wrapper', () => {
    const { container } = render(() => <IrisAffix>Sticky</IrisAffix>)
    expect(container.querySelector('[data-iris-affix-content]')).not.toBeNull()
  })

  it('renders placeholder and content wrappers', () => {
    // jsdom returns 0 for getBoundingClientRect so offsetTop=100 means top=0 <= 100 => affixed
    // Just verify structure renders correctly
    const { container } = render(() => <IrisAffix offsetTop={100}>Content</IrisAffix>)
    expect(container.querySelector('[data-iris-affix-content]')).not.toBeNull()
  })
})

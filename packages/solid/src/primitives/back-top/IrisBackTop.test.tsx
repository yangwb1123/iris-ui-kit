import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { IrisBackTop } from './IrisBackTop'

afterEach(cleanup)

describe('IrisBackTop', () => {
  it('renders without crashing (not visible initially)', () => {
    const { container } = render(() => <IrisBackTop />)
    // Not visible until scroll threshold passed
    expect(container.querySelector('[data-iris-back-top]')).toBeNull()
  })

  it('shows button when visibilityHeight is 0 (threshold already met at scrollY=0)', () => {
    // In jsdom scrollY=0, so visibilityHeight=0 means 0 >= 0 which IS visible
    const { container } = render(() => <IrisBackTop visibilityHeight={0} />)
    // 0 >= 0 so it should be visible
    expect(container.querySelector('[data-iris-back-top]')).not.toBeNull()
  })
})

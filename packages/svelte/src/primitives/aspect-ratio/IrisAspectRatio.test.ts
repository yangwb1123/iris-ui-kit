import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisAspectRatio from './IrisAspectRatio.svelte'

afterEach(cleanup)

describe('@iris-ui-kit/svelte IrisAspectRatio', () => {
  it('renders outer div with data-iris-aspect-ratio', () => {
    const { container } = render(IrisAspectRatio)
    expect(container.querySelector('[data-iris-aspect-ratio]')).not.toBeNull()
  })

  it('sets data-ratio attribute', () => {
    const { container } = render(IrisAspectRatio, { props: { ratio: 4 / 3 } })
    const el = container.querySelector('[data-iris-aspect-ratio]')!
    expect(el.getAttribute('data-ratio')).toBeTruthy()
  })

  it('renders inner content container', () => {
    const { container } = render(IrisAspectRatio)
    expect(container.querySelector('[data-iris-aspect-ratio-content]')).not.toBeNull()
  })

  it('applies aspect-ratio CSS to outer element style', () => {
    const { container } = render(IrisAspectRatio, { props: { ratio: 1 } })
    const el = container.querySelector<HTMLElement>('[data-iris-aspect-ratio]')!
    expect(el.getAttribute('style')).toContain('aspect-ratio')
  })
})

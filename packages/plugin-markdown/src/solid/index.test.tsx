import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisMarkdown } from './index'

afterEach(cleanup)

describe('IrisMarkdown (solid)', () => {
  it('renders the data-iris-markdown container', () => {
    const { container } = render(() => <IrisMarkdown content="Hello" />)
    expect(container.querySelector('[data-iris-markdown]')).toBeTruthy()
  })

  it('renders a heading from # syntax', () => {
    const { container } = render(() => <IrisMarkdown content="# Hello World" />)
    expect(container.querySelector('h1')).toBeTruthy()
    expect(container.querySelector('h1')?.textContent).toBe('Hello World')
  })

  it('renders bold and italic', () => {
    const { container } = render(() => <IrisMarkdown content="**bold** and *italic*" />)
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelector('em')?.textContent).toBe('italic')
  })

  it('renders an unordered list', () => {
    const { container } = render(() => <IrisMarkdown content={'- Alpha\n- Beta'} />)
    expect(container.querySelector('ul')).toBeTruthy()
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(2)
  })

  it('renders a link', () => {
    const { container } = render(() => <IrisMarkdown content="[Iris](https://iris-ui.dev)" />)
    const a = container.querySelector('a')
    expect(a?.getAttribute('href')).toBe('https://iris-ui.dev')
  })

  it('does not render script tags', () => {
    const { container } = render(() => <IrisMarkdown content={'<script>alert(1)</script>Safe'} />)
    expect(container.querySelector('script')).toBeNull()
  })

  it('accepts a class prop', () => {
    const { container } = render(() => <IrisMarkdown content="Hi" class="prose" />)
    expect(container.querySelector('.prose')).toBeTruthy()
  })
})

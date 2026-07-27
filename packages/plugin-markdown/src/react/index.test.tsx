import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { IrisMarkdown } from './index'

afterEach(cleanup)

describe('IrisMarkdown (react)', () => {
  it('renders the data-iris-markdown container', () => {
    const { container } = render(<IrisMarkdown content="Hello" />)
    expect(container.querySelector('[data-iris-markdown]')).toBeTruthy()
  })

  it('renders a heading from # syntax', () => {
    const { container } = render(<IrisMarkdown content="# Hello World" />)
    expect(container.querySelector('h1')).toBeTruthy()
    expect(container.querySelector('h1')?.textContent).toBe('Hello World')
  })

  it('renders bold and italic inline elements', () => {
    const { container } = render(<IrisMarkdown content="**bold** and *italic*" />)
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelector('em')?.textContent).toBe('italic')
  })

  it('renders a paragraph for plain text', () => {
    const { container } = render(<IrisMarkdown content="Just a paragraph." />)
    expect(container.querySelector('p')?.textContent).toBe('Just a paragraph.')
  })

  it('renders an unordered list', () => {
    const { container } = render(<IrisMarkdown content={'- Alpha\n- Beta'} />)
    expect(container.querySelector('ul')).toBeTruthy()
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(2)
    expect(items[0]?.textContent).toBe('Alpha')
  })

  it('renders an ordered list', () => {
    const { container } = render(<IrisMarkdown content={'1. One\n2. Two'} />)
    expect(container.querySelector('ol')).toBeTruthy()
  })

  it('renders inline code', () => {
    const { container } = render(<IrisMarkdown content="Use `npm install`" />)
    expect(container.querySelector('code')?.textContent).toBe('npm install')
  })

  it('renders a fenced code block', () => {
    const { container } = render(<IrisMarkdown content={'```js\nconsole.log(1)\n```'} />)
    expect(container.querySelector('pre')).toBeTruthy()
    expect(container.querySelector('code')).toBeTruthy()
  })

  it('renders a link', () => {
    const { container } = render(<IrisMarkdown content="[Iris](https://iris-ui.dev)" />)
    const a = container.querySelector('a')
    expect(a?.getAttribute('href')).toBe('https://iris-ui.dev')
    expect(a?.textContent).toBe('Iris')
  })

  it('renders a blockquote', () => {
    const { container } = render(<IrisMarkdown content="> A quote" />)
    expect(container.querySelector('blockquote')).toBeTruthy()
    expect(container.querySelector('blockquote')?.textContent).toContain('A quote')
  })

  it('does not render script tags from content', () => {
    const { container } = render(
      <IrisMarkdown content={'<script>alert("xss")</script>Safe text'} />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('Safe text')
  })

  it('renders allowlisted raw tags as elements and encoded tags as inert text', () => {
    const { container } = render(
      <IrisMarkdown content={'<mark>safe</mark> &lt;script&gt;not markup&lt;/script&gt;'} />,
    )
    expect(container.querySelector('mark')?.textContent).toBe('safe')
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<script>not markup</script>')
  })

  it('accepts a className prop', () => {
    const { container } = render(<IrisMarkdown content="Hi" className="prose" />)
    expect(container.querySelector('.prose')).toBeTruthy()
  })
})

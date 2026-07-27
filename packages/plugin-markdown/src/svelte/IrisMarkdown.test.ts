import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import IrisMarkdown from './IrisMarkdown.svelte'

describe('IrisMarkdown (svelte)', () => {
  it('renders the data-iris-markdown container', () => {
    const { container } = render(IrisMarkdown, { props: { content: 'Hello' } })
    expect(container.querySelector('[data-iris-markdown]')).toBeTruthy()
  })

  it('renders a heading from # syntax', () => {
    const { container } = render(IrisMarkdown, { props: { content: '# Hello World' } })
    expect(container.querySelector('h1')).toBeTruthy()
    expect(container.querySelector('h1')?.textContent).toBe('Hello World')
  })

  it('renders bold and italic', () => {
    const { container } = render(IrisMarkdown, {
      props: { content: '**bold** and *italic*' },
    })
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelector('em')?.textContent).toBe('italic')
  })

  it('renders an unordered list', () => {
    const { container } = render(IrisMarkdown, { props: { content: '- Alpha\n- Beta' } })
    expect(container.querySelector('ul')).toBeTruthy()
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(2)
  })

  it('renders a link', () => {
    const { container } = render(IrisMarkdown, {
      props: { content: '[Iris](https://iris-ui.dev)' },
    })
    const a = container.querySelector('a')
    expect(a?.getAttribute('href')).toBe('https://iris-ui.dev')
  })

  it('does not render script tags', () => {
    const { container } = render(IrisMarkdown, {
      props: { content: '<script>alert(1)</script>Safe' },
    })
    expect(container.querySelector('script')).toBeNull()
  })

  it('renders allowlisted raw tags without interpreting encoded markup', () => {
    const { container } = render(IrisMarkdown, {
      props: { content: '<mark>safe</mark> &lt;script&gt;inert&lt;/script&gt;' },
    })
    expect(container.querySelector('mark')?.textContent).toBe('safe')
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<script>inert</script>')
  })

  it('accepts a class prop', () => {
    const { container } = render(IrisMarkdown, { props: { content: 'Hi', class: 'prose' } })
    expect(container.querySelector('.prose')).toBeTruthy()
  })
})

import { describe, it, expect } from 'vitest'
import { runPlugins } from '@iris-ui/core'
import { markdownToHtml, markdownPlugin, markdownTokens } from './index'

describe('markdownToHtml — block features', () => {
  it('converts h1 through h6 headings', () => {
    expect(markdownToHtml('# Hello')).toContain('<h1>Hello</h1>')
    expect(markdownToHtml('## World')).toContain('<h2>World</h2>')
    expect(markdownToHtml('###### Tiny')).toContain('<h6>Tiny</h6>')
  })

  it('wraps plain text in <p> tags', () => {
    expect(markdownToHtml('Hello world')).toContain('<p>Hello world</p>')
  })

  it('converts blockquotes', () => {
    const html = markdownToHtml('> This is a quote')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('This is a quote')
  })

  it('converts unordered lists (-, *, +)', () => {
    const html = markdownToHtml('- Apple\n- Banana\n- Cherry')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>Apple</li>')
    expect(html).toContain('<li>Banana</li>')
    expect(html).toContain('<li>Cherry</li>')
  })

  it('converts ordered lists', () => {
    const html = markdownToHtml('1. First\n2. Second\n3. Third')
    expect(html).toContain('<ol>')
    expect(html).toContain('<li>First</li>')
    expect(html).toContain('<li>Second</li>')
  })

  it('converts fenced code blocks', () => {
    const md = '```ts\nconst x = 1\n```'
    const html = markdownToHtml(md)
    expect(html).toContain('<pre><code')
    expect(html).toContain('class="language-ts"')
    expect(html).toContain('const x = 1')
  })

  it('converts fenced code block without a language tag', () => {
    const md = '```\nhello\n```'
    const html = markdownToHtml(md)
    expect(html).toContain('<pre><code>')
    expect(html).toContain('hello')
  })
})

describe('markdownToHtml — inline features', () => {
  it('converts **bold**', () => {
    expect(markdownToHtml('**bold**')).toContain('<strong>bold</strong>')
  })

  it('converts __bold__', () => {
    expect(markdownToHtml('__bold__')).toContain('<strong>bold</strong>')
  })

  it('converts *italic*', () => {
    expect(markdownToHtml('*italic*')).toContain('<em>italic</em>')
  })

  it('converts _italic_', () => {
    expect(markdownToHtml('_italic_')).toContain('<em>italic</em>')
  })

  it('converts `inline code`', () => {
    const html = markdownToHtml('Use `console.log` here')
    expect(html).toContain('<code>console.log</code>')
  })

  it('converts [link](url)', () => {
    const html = markdownToHtml('[Iris UI](https://iris-ui.dev)')
    expect(html).toContain('<a href="https://iris-ui.dev">Iris UI</a>')
  })
})

describe('markdownToHtml — security', () => {
  it('strips <script> tags', () => {
    const html = markdownToHtml('<script>alert("xss")</script>Hello')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('alert')
    expect(html).toContain('Hello')
  })

  it('strips <script> tags inside markdown content', () => {
    const html = markdownToHtml('## Title\n\n<script>evil()</script>\n\nParagraph')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('evil()')
  })

  it('strips javascript: hrefs in links', () => {
    const html = markdownToHtml('[click](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
  })

  it('strips javascript: hrefs with mixed case', () => {
    const html = markdownToHtml('[xss](JavaScript:alert(1))')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('JavaScript:')
  })

  it('allows normal https links through', () => {
    const html = markdownToHtml('[Safe](https://example.com)')
    expect(html).toContain('https://example.com')
  })
})

describe('markdownPlugin', () => {
  it('registers markdown tokens', () => {
    const { tokens } = runPlugins([markdownPlugin])
    expect(tokens['--iris-md-font']).toBe(markdownTokens['--iris-md-font'])
    expect(tokens['--iris-md-code-bg']).toBe(markdownTokens['--iris-md-code-bg'])
  })
})

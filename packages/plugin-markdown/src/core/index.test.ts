import { describe, it, expect } from 'vitest'
import { runPlugins } from '@iris-ui-kit/core'
import {
  markdownToHtml,
  markdownToNodes,
  markdownPlugin,
  markdownTokens,
  sanitizedHtmlToNodes,
} from './index'

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

describe('markdownToHtml — XSS sanitizer (allowlist)', () => {
  it('strips UNQUOTED event handlers (the blacklist bypass)', () => {
    const html = markdownToHtml('<img src=x onerror=alert(1)>')
    expect(html).not.toMatch(/onerror/i)
    expect(html).not.toContain('alert(1)')
  })

  it('strips quoted event handlers too', () => {
    const html = markdownToHtml('<div onclick="alert(1)">hi</div>')
    expect(html).not.toMatch(/onclick/i)
    expect(html).not.toContain('alert(1)')
  })

  it('strips the formaction vector', () => {
    const html = markdownToHtml('<button formaction="javascript:alert(1)">go</button>')
    expect(html).not.toMatch(/formaction/i)
    expect(html).not.toContain('javascript:alert(1)')
    // <button> is not allowlisted, so its markup is dropped entirely.
    expect(html).not.toContain('<button')
  })

  it('removes <object>, <embed>, <svg>, and <math> with their content', () => {
    for (const vec of [
      '<object data="javascript:alert(1)"></object>',
      '<embed src="javascript:alert(1)">',
      '<svg><script>alert(1)</script></svg>',
      '<math><mtext><script>alert(1)</script></mtext></math>',
    ]) {
      const html = markdownToHtml(vec)
      expect(html).not.toContain('alert(1)')
      expect(html).not.toMatch(/<(object|embed|svg|math|script)/i)
    }
  })

  it('strips <style> blocks and their content', () => {
    const html = markdownToHtml('<style>body{background:url(javascript:alert(1))}</style>ok')
    expect(html).not.toContain('<style')
    expect(html).not.toContain('alert(1)')
    expect(html).toContain('ok')
  })

  it('neutralizes entity-encoded javascript: URLs', () => {
    const html = markdownToHtml('<a href="&#106;avascript:alert(1)">x</a>')
    expect(html).not.toContain('avascript:alert')
    expect(html).toContain('href="#"')
  })

  it('neutralizes javascript: URLs with embedded control characters', () => {
    const html = markdownToHtml('<a href="java\tscript:alert(1)">x</a>')
    expect(html).toContain('href="#"')
  })

  it('blocks data: URLs in links', () => {
    const html = markdownToHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>')
    expect(html).toContain('href="#"')
    expect(html).not.toContain('text/html')
  })

  it('drops disallowed tags but keeps their text content', () => {
    const html = markdownToHtml('<marquee>hello</marquee>')
    expect(html).not.toContain('<marquee')
    expect(html).toContain('hello')
  })

  it('preserves the language class the generator emits on code fences', () => {
    const html = markdownToHtml('```ts\nconst x = 1\n```')
    expect(html).toContain('class="language-ts"')
  })

  it('drops a non-language class injected via raw HTML', () => {
    const html = markdownToHtml('<code class="evil">x</code>')
    expect(html).not.toContain('evil')
    expect(html).toContain('<code>x</code>')
  })

  it('keeps safe anchors intact', () => {
    const html = markdownToHtml('[Iris UI](https://iris-ui.dev)')
    expect(html).toContain('<a href="https://iris-ui.dev">Iris UI</a>')
  })

  it('prevents attribute breakout via a quote in a raw href', () => {
    const html = markdownToHtml('<a href="x" onmouseover="alert(1)">x</a>')
    expect(html).not.toMatch(/onmouseover/i)
    expect(html).not.toContain('alert(1)')
  })
})

describe('markdownToNodes — structured rendering', () => {
  it('preserves the supported structure without carrying an HTML string sink', () => {
    expect(markdownToNodes('# Hello **Iris**')).toEqual([
      {
        type: 'element',
        tag: 'h1',
        attrs: {},
        children: [
          { type: 'text', value: 'Hello ' },
          {
            type: 'element',
            tag: 'strong',
            attrs: {},
            children: [{ type: 'text', value: 'Iris' }],
          },
        ],
      },
    ])
  })

  it('decodes escaped markup as inert text nodes', () => {
    const nodes = markdownToNodes('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(nodes).toEqual([
      {
        type: 'element',
        tag: 'p',
        attrs: {},
        children: [{ type: 'text', value: '<script>alert(1)</script>' }],
      },
    ])
  })

  it('keeps only allowlisted, URL-sanitized attributes', () => {
    const nodes = markdownToNodes(
      '<a href="javascript:alert(1)" onclick="alert(2)">safe</a><img src=x onerror=alert(3)>',
    )
    expect(JSON.stringify(nodes)).not.toMatch(/onclick|onerror|javascript:/i)
    expect(nodes).toMatchObject([
      {
        type: 'element',
        tag: 'p',
        children: [
          { type: 'element', tag: 'a', attrs: { href: '#' } },
          { type: 'element', tag: 'img', attrs: { src: 'x' } },
        ],
      },
    ])
  })

  it('recovers deterministically from mismatched closing tags', () => {
    expect(sanitizedHtmlToNodes('<p><strong>safe</p>tail')).toEqual([
      {
        type: 'element',
        tag: 'p',
        attrs: {},
        children: [
          {
            type: 'element',
            tag: 'strong',
            attrs: {},
            children: [{ type: 'text', value: 'safe' }],
          },
        ],
      },
      { type: 'text', value: 'tail' },
    ])
  })
})

describe('markdownPlugin', () => {
  it('registers markdown tokens', () => {
    const { tokens } = runPlugins([markdownPlugin])
    expect(tokens['--iris-md-font']).toBe(markdownTokens['--iris-md-font'])
    expect(tokens['--iris-md-code-bg']).toBe(markdownTokens['--iris-md-code-bg'])
  })
})

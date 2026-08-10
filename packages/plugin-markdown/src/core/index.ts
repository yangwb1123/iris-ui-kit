import { createPlugin } from '@iris-ui-kit/core'

/**
 * `@iris-ui-kit/plugin-markdown` — core entry.
 *
 * Provides a minimal Markdown→HTML converter (`markdownToHtml`) with no
 * external dependencies, plus the plugin registration object and design tokens.
 *
 * Supported Markdown features:
 *  - Headings: # h1 … ###### h6
 *  - Bold: **text** or __text__
 *  - Italic: *text* or _text_
 *  - Inline code: `code`
 *  - Fenced code blocks: ```lang\ncode\n```
 *  - Blockquotes: > text
 *  - Unordered lists: - item / * item / + item
 *  - Ordered lists: 1. item
 *  - Links: [label](url)
 *  - Paragraphs: blank-line separated text
 *
 * Security: the generated HTML is passed through an allowlist sanitizer
 * (see {@link sanitizeHtml}) before it is returned. Framework adapters consume
 * {@link markdownToNodes}, which turns that safe subset into structured nodes
 * instead of using an `innerHTML` sink.
 */

// ---------------------------------------------------------------------------
// Security: allowlist sanitizer
// ---------------------------------------------------------------------------
//
// A blocklist (strip <script>, strip on*= handlers, …) is unsound: it is
// trivially bypassed by unquoted handler values (`<img src=x onerror=alert(1)>`),
// alternate vectors (formaction, xlink:href, srcset), embedded elements
// (<object>/<embed>/<svg>/<math>), and entity-encoded protocols. We instead
// allow only a known-safe set of tags and, per tag, a known-safe set of
// attributes — everything else is dropped. This is the OWASP-recommended
// approach and needs no third-party dependency.

/** Tags kept during sanitization. Anything else has its markup removed. */
export const MARKDOWN_ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'ins',
  'mark',
  'small',
  'sub',
  'sup',
  'code',
  'pre',
  'kbd',
  'samp',
  'var',
  'blockquote',
  'q',
  'cite',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'a',
  'abbr',
  'span',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'img',
] as const

export type MarkdownTag = (typeof MARKDOWN_ALLOWED_TAGS)[number]

const ALLOWED_TAGS = new Set<string>(MARKDOWN_ALLOWED_TAGS)

/** Per-tag attribute allowlist. Tags absent here keep no attributes. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  code: new Set(['class']),
  pre: new Set(['class']),
  th: new Set(['scope', 'colspan', 'rowspan']),
  td: new Set(['colspan', 'rowspan']),
}

/**
 * Content-bearing elements whose *inner text* is dangerous or executable and
 * so must be removed together with their contents (not merely un-tagged, which
 * would leave e.g. script source as visible — and in some sinks executable —
 * text). Void/unknown dangerous tags (base, link, meta, …) are handled by the
 * generic tag filter, which drops any non-allowlisted tag.
 */
const DANGEROUS_BLOCK_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'template',
  'noscript',
  'title',
  'head',
  'textarea',
  'xmp',
]

/** Decode the HTML entities an attacker can use to hide a `javascript:` scheme. */
function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    tab: '\t',
    newline: '\n',
    colon: ':',
    lt: '<',
    gt: '>',
    quot: '"',
    amp: '&',
    apos: "'",
    sol: '/',
    nbsp: ' ',
  }
  return input
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_m, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&(\w+);/g, (m, name) => named[String(name).toLowerCase()] ?? m)
}

function safeFromCodePoint(cp: number): string {
  return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ''
}

const SAFE_URL_SCHEMES = new Set(['http', 'https', 'mailto', 'tel', 'ftp'])

/**
 * Return `url` if its scheme is safe (or it is scheme-relative / a fragment),
 * otherwise `'#'`. Entities and control/whitespace characters — which browsers
 * ignore inside a URL — are decoded/stripped before the scheme is read, so
 * `java&#115;cript:` and `java\tscript:` cannot smuggle a scheme past the check.
 */
function sanitizeUrl(url: string): string {
  // Decode to a fixed point so double-encoded schemes (`&amp;#106;…`) are caught.
  let decoded = url
  for (let i = 0; i < 4; i++) {
    const next = decodeEntities(decoded)
    if (next === decoded) break
    decoded = next
  }
  // eslint-disable-next-line no-control-regex
  decoded = decoded.replace(/[\u0000-\u0020]+/g, '')
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(decoded)
  if (scheme && !SAFE_URL_SCHEMES.has(scheme[1]!.toLowerCase())) return '#'
  return url
}

/** Escape a value for safe emission inside a double-quoted attribute. */
function escapeAttrValue(value: string): string {
  return value.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Reduce a start-tag's attributes to the per-tag allowlist, sanitizing URLs. */
function filterAttributes(tag: string, attrText: string): string {
  const allowed = ALLOWED_ATTRS[tag]
  if (!allowed || !attrText.trim()) return ''
  let out = ''
  const attrRe = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
  let m: RegExpExecArray | null
  while ((m = attrRe.exec(attrText)) !== null) {
    const name = m[1]!.toLowerCase()
    if (!allowed.has(name)) continue
    let value = m[3] ?? m[4] ?? m[5] ?? ''
    if (name === 'href' || name === 'src') value = sanitizeUrl(value)
    // Only `language-*` classes (emitted for code fences) are meaningful.
    if (name === 'class' && !/^(language-[\w-]+\s*)+$/.test(value.trim())) continue
    out += ` ${name}="${escapeAttrValue(value)}"`
  }
  return out
}

/**
 * Allowlist-sanitize an HTML fragment: remove dangerous elements with their
 * content, then keep only allowlisted tags (each stripped to its allowlisted,
 * URL-sanitized attributes) and drop the markup of everything else.
 */
function sanitizeHtml(html: string): string {
  let out = html
  for (const tag of DANGEROUS_BLOCK_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'gi'), '')
    out = out.replace(new RegExp(`<${tag}\\b[^>]*?>`, 'gi'), '')
  }
  return out.replace(
    /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^"'>])*?)(\/?)>/g,
    (_full, closing: string, name: string, attrs: string, selfClose: string) => {
      const tag = name.toLowerCase()
      if (!ALLOWED_TAGS.has(tag)) return ''
      if (closing) return `</${tag}>`
      return `<${tag}${filterAttributes(tag, attrs)}${selfClose ? ' /' : ''}>`
    },
  )
}

// ---------------------------------------------------------------------------
// Escape helpers
// ---------------------------------------------------------------------------

/** HTML-escape a raw string so it is safe to embed in attribute values or text. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Inline transforms (applied within block content)
// ---------------------------------------------------------------------------

function applyInline(text: string): string {
  // Links: [label](url) — sanitize url to block javascript: hrefs
  let out = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const safeUrl = /^\s*javascript\s*:/i.test(url) ? '#' : url
    return `<a href="${escapeHtml(safeUrl)}">${label}</a>`
  })

  // Inline code: `code`
  out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`)

  // Bold: **text** or __text__
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>')

  // Italic: *text* or _text_ (not adjacent to word chars on both sides to
  // avoid munging snake_case identifiers already processed above)
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  out = out.replace(/_([^_]+)_/g, '<em>$1</em>')

  return out
}

// ---------------------------------------------------------------------------
// Block-level parser
// ---------------------------------------------------------------------------

/**
 * Convert Markdown text to an HTML string.
 *
 * The conversion is line/block-based:
 * 1. Fenced code blocks are extracted first (they must not be processed for
 *    inline syntax).
 * 2. The remainder is split into "block groups" separated by blank lines.
 * 3. Each group is classified as a heading, blockquote, list, or paragraph.
 * 4. Inline transforms are applied to non-code content.
 * 5. The result is passed through the allowlist sanitizer (see sanitizeHtml).
 */
export function markdownToHtml(md: string): string {
  // Normalize line endings
  const src = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // ---- Step 1: extract fenced code blocks --------------------------------
  // Replace ```lang\ncode\n``` with a placeholder; restore after block parse.
  const codeBlocks: string[] = []
  const withPlaceholders = src.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const langAttr = lang.trim() ? ` class="language-${escapeHtml(lang.trim())}"` : ''
    codeBlocks.push(`<pre><code${langAttr}>${escapeHtml(code)}</code></pre>`)
    return `IRIS_CODE_BLOCK_${codeBlocks.length - 1}_END`
  })

  // ---- Step 2: split into blank-line-separated groups --------------------
  const blocks = withPlaceholders.split(/\n{2,}/)

  const parts: string[] = []

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    // Code block placeholder
    const codeMatch = trimmed.match(/^IRIS_CODE_BLOCK_(\d+)_END$/)
    if (codeMatch) {
      const idx = parseInt(codeMatch[1]!, 10)
      parts.push(codeBlocks[idx]!)
      continue
    }

    // Heading: # … ######
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1]!.length
      const content = applyInline(headingMatch[2]!)
      parts.push(`<h${level}>${content}</h${level}>`)
      continue
    }

    // Blockquote: lines starting with >
    if (/^>/.test(trimmed)) {
      const inner = trimmed
        .split('\n')
        .map((line) => line.replace(/^>\s?/, ''))
        .join('\n')
      parts.push(`<blockquote>${applyInline(inner)}</blockquote>`)
      continue
    }

    // Unordered list: lines starting with - / * / +
    if (/^[-*+]\s/.test(trimmed)) {
      const items = trimmed
        .split('\n')
        .filter((l) => /^[-*+]\s/.test(l))
        .map((l) => `<li>${applyInline(l.replace(/^[-*+]\s+/, ''))}</li>`)
        .join('')
      parts.push(`<ul>${items}</ul>`)
      continue
    }

    // Ordered list: lines starting with digits + dot
    if (/^\d+\.\s/.test(trimmed)) {
      const items = trimmed
        .split('\n')
        .filter((l) => /^\d+\.\s/.test(l))
        .map((l) => `<li>${applyInline(l.replace(/^\d+\.\s+/, ''))}</li>`)
        .join('')
      parts.push(`<ol>${items}</ol>`)
      continue
    }

    // Paragraph: join lines with a space, apply inline transforms
    const para = trimmed.split('\n').join(' ')
    parts.push(`<p>${applyInline(para)}</p>`)
  }

  const html = parts.join('\n')
  return sanitizeHtml(html)
}

// ---------------------------------------------------------------------------
// Structured renderer output
// ---------------------------------------------------------------------------

export interface MarkdownTextNode {
  type: 'text'
  value: string
}

export interface MarkdownElementNode {
  type: 'element'
  tag: MarkdownTag
  attrs: Record<string, string>
  children: MarkdownNode[]
}

export type MarkdownNode = MarkdownTextNode | MarkdownElementNode

const VOID_TAGS = new Set<MarkdownTag>(['br', 'hr', 'img'])

/**
 * Decode the entity forms emitted by this converter. The value remains a text
 * node or a framework-set attribute; decoded `<`/`"` characters never become
 * markup because adapters do not use an HTML string sink.
 */
function decodeRenderedEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_match, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_match, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/gi, (_match, name: string) => {
      const entities: Record<string, string> = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
      }
      return entities[name.toLowerCase()]!
    })
}

function parseSafeAttributes(attrText: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const attrRe = /([a-zA-Z_:][\w:.-]*)="([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = attrRe.exec(attrText)) !== null) {
    attrs[match[1]!] = decodeRenderedEntities(match[2]!)
  }
  return attrs
}

/**
 * Parse sanitizer output into a tiny framework-neutral tree. This parser only
 * receives the converter's allowlisted HTML, so it intentionally supports just
 * start/end tags, double-quoted attributes, and text. Mismatched closing tags
 * close the nearest matching open element without ever creating a new tag.
 */
export function sanitizedHtmlToNodes(html: string): MarkdownNode[] {
  const roots: MarkdownNode[] = []
  const stack: MarkdownElementNode[] = []
  const append = (node: MarkdownNode): void => {
    const parent = stack.at(-1)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const tokenRe = /<(?:(\/)([a-zA-Z][\w:-]*)|([a-zA-Z][\w:-]*)([^>]*?)(\/?))>|([^<]+)/g
  let match: RegExpExecArray | null
  while ((match = tokenRe.exec(html)) !== null) {
    if (match[6] !== undefined) {
      if (match[6]) append({ type: 'text', value: decodeRenderedEntities(match[6]) })
      continue
    }

    if (match[1]) {
      const closingTag = match[2]!.toLowerCase()
      let index = -1
      for (let cursor = stack.length - 1; cursor >= 0; cursor -= 1) {
        if (stack[cursor]!.tag === closingTag) {
          index = cursor
          break
        }
      }
      if (index >= 0) stack.length = index
      continue
    }

    const tag = match[3]!.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) continue
    const node: MarkdownElementNode = {
      type: 'element',
      tag: tag as MarkdownTag,
      attrs: parseSafeAttributes(match[4] ?? ''),
      children: [],
    }
    append(node)
    if (!match[5] && !VOID_TAGS.has(node.tag)) stack.push(node)
  }
  return roots
}

/**
 * Convert Markdown directly into structured, allowlisted render nodes.
 * Framework adapters should use this API; `markdownToHtml` remains available
 * for serialization/export compatibility.
 */
export function markdownToNodes(md: string): MarkdownNode[] {
  return sanitizedHtmlToNodes(markdownToHtml(md))
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

/** CSS custom properties the markdown renderer reads; overridable by the host theme. */
export const markdownTokens: Record<string, string> = {
  '--iris-md-font': 'var(--iris-font-family)',
}

// ---------------------------------------------------------------------------
// Plugin registration
// ---------------------------------------------------------------------------

/**
 * The markdown plugin. Pass to `<IrisProvider plugins={[markdownPlugin]}>`.
 * Registers the markdown theme tokens.
 */
export const markdownPlugin = createPlugin({
  name: 'markdown',
  install(registry) {
    registry.registerTokens(markdownTokens)
  },
})

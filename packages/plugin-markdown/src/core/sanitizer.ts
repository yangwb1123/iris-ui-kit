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

export const ALLOWED_TAGS = new Set<string>(MARKDOWN_ALLOWED_TAGS)

/** Per-tag attribute allowlist. Tags absent here keep no attributes. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  code: new Set(['class']),
  pre: new Set(['class']),
  th: new Set(['scope', 'colspan', 'rowspan']),
  td: new Set(['colspan', 'rowspan']),
}

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

export function safeFromCodePoint(cp: number): string {
  return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ''
}

const SAFE_URL_SCHEMES = new Set(['http', 'https', 'mailto', 'tel', 'ftp'])

function sanitizeUrl(url: string): string {
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

function escapeAttrValue(value: string): string {
  return value.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function filterAttributes(tag: string, attrText: string): string {
  const allowed = ALLOWED_ATTRS[tag]
  if (!allowed || !attrText.trim()) return ''
  let out = ''
  const attrRe = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
  let match: RegExpExecArray | null
  while ((match = attrRe.exec(attrText)) !== null) {
    const name = match[1]!.toLowerCase()
    if (!allowed.has(name)) continue
    let value = match[3] ?? match[4] ?? match[5] ?? ''
    if (name === 'href' || name === 'src') value = sanitizeUrl(value)
    if (name === 'class' && !/^(language-[\w-]+\s*)+$/.test(value.trim())) continue
    out += ` ${name}="${escapeAttrValue(value)}"`
  }
  return out
}

/** Allowlist-sanitize an HTML fragment and remove dangerous element contents. */
export function sanitizeHtml(html: string): string {
  let out = html
  for (const tag of DANGEROUS_BLOCK_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'gi'), '')
    out = out.replace(new RegExp(`<${tag}\\b[^>]*?>`, 'gi'), '')
  }
  return out.replace(
    /<(\/?)(([a-zA-Z][\w:-]*))((?:"[^"]*"|'[^']*'|[^"'>])*?)(\/?)>/g,
    (_full, closing: string, name: string, _same: string, attrs: string, selfClose: string) => {
      const tag = name.toLowerCase()
      if (!ALLOWED_TAGS.has(tag)) return ''
      if (closing) return `</${tag}>`
      return `<${tag}${filterAttributes(tag, attrs)}${selfClose ? ' /' : ''}>`
    },
  )
}

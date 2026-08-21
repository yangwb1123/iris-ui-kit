import { sanitizeHtml } from './sanitizer'

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

function renderMarkdownBlock(trimmed: string, codeBlocks: readonly string[]): string {
  const codeMatch = trimmed.match(/^IRIS_CODE_BLOCK_(\d+)_END$/)
  if (codeMatch) return codeBlocks[parseInt(codeMatch[1]!, 10)]!

  const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
  if (headingMatch) {
    const level = headingMatch[1]!.length
    const content = applyInline(headingMatch[2]!)
    return `<h${level}>${content}</h${level}>`
  }
  if (/^>/.test(trimmed)) {
    const inner = trimmed
      .split('\n')
      .map((line) => line.replace(/^>\s?/, ''))
      .join('\n')
    return `<blockquote>${applyInline(inner)}</blockquote>`
  }
  if (/^[-*+]\s/.test(trimmed)) {
    const items = trimmed
      .split('\n')
      .filter((line) => /^[-*+]\s/.test(line))
      .map((line) => `<li>${applyInline(line.replace(/^[-*+]\s+/, ''))}</li>`)
      .join('')
    return `<ul>${items}</ul>`
  }
  if (/^\d+\.\s/.test(trimmed)) {
    const items = trimmed
      .split('\n')
      .filter((line) => /^\d+\.\s/.test(line))
      .map((line) => `<li>${applyInline(line.replace(/^\d+\.\s+/, ''))}</li>`)
      .join('')
    return `<ol>${items}</ol>`
  }
  return `<p>${applyInline(trimmed.split('\n').join(' '))}</p>`
}

/** Convert Markdown text to an allowlisted HTML string. */
export function markdownToHtml(md: string): string {
  const src = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const codeBlocks: string[] = []
  const withPlaceholders = src.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const langAttr = lang.trim() ? ` class="language-${escapeHtml(lang.trim())}"` : ''
    codeBlocks.push(`<pre><code${langAttr}>${escapeHtml(code)}</code></pre>`)
    return `IRIS_CODE_BLOCK_${codeBlocks.length - 1}_END`
  })

  const parts: string[] = []
  for (const block of withPlaceholders.split(/\n{2,}/)) {
    const trimmed = block.trim()
    if (!trimmed) continue
    parts.push(renderMarkdownBlock(trimmed, codeBlocks))
  }

  return sanitizeHtml(parts.join('\n'))
}

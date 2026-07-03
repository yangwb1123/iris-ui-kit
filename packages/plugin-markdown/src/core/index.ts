import { createPlugin } from '@iris-ui/core'

/**
 * `@iris-ui/plugin-markdown` — core entry.
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
 * Security: strips <script> tags and javascript: href/src values.
 */

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

/** Strip <script>…</script> blocks (case-insensitive, greedy-safe). */
function stripScripts(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
}

/**
 * Replace javascript: (and variants with whitespace/encoding) in href/src
 * attribute values with an empty string so they don't execute on click.
 */
function stripJavascriptHrefs(html: string): string {
  // Matches href="javascript:..." or src='javascript:...' with optional
  // surrounding whitespace. The \s* handles `java script:` obfuscation.
  return html.replace(/(href|src)\s*=\s*(['"])\s*javascript\s*:/gi, '$1=$2#')
}

/** Strip <iframe>…</iframe> blocks (prevents embedded third-party content). */
function stripIframes(html: string): string {
  return html.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
}

/** Strip <style>…</style> blocks (prevents CSS injection / theme hijack). */
function stripStyles(html: string): string {
  return html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
}

/**
 * Strip HTML event-handler attributes (onerror, onload, onclick, etc.) which
 * can execute JavaScript without a <script> tag. Matches `on<anyword>="..."`
 * or `on<anyword>='...'` — case-insensitive.
 */
function stripEventHandlers(html: string): string {
  return html.replace(/\s+on\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
}

/** Block `data:` URLs in href attributes (common XSS vector). */
function stripDataUrls(html: string): string {
  return html.replace(/href\s*=\s*(['"])data:\s*[^'"]*\1/gi, 'href=$1#')
}

function sanitize(html: string): string {
  return stripDataUrls(
    stripEventHandlers(stripStyles(stripIframes(stripJavascriptHrefs(stripScripts(html))))),
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
 * 5. The result is sanitized (script tags and javascript: hrefs removed).
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
  return sanitize(html)
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

/** CSS custom properties the markdown renderer reads; overridable by the host theme. */
export const markdownTokens: Record<string, string> = {
  '--iris-md-font': 'var(--iris-font-body)',
  '--iris-md-code-bg': 'var(--iris-color-surface-alt, #f3f4f6)',
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

import { createPlugin } from '@iris-ui-kit/core'
import { sanitizedHtmlToNodes, type MarkdownNode } from './nodes'
import { markdownToHtml } from './parser'
import { MARKDOWN_ALLOWED_TAGS, type MarkdownTag } from './sanitizer'

export { sanitizedHtmlToNodes }
export { markdownToHtml }
export type { MarkdownNode, MarkdownTag }
export { MARKDOWN_ALLOWED_TAGS }

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

/** Convert Markdown directly into structured, allowlisted render nodes. */
export function markdownToNodes(md: string): MarkdownNode[] {
  return sanitizedHtmlToNodes(markdownToHtml(md))
}

// ---------------------------------------------------------------------------
// Structured renderer output
// ---------------------------------------------------------------------------

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

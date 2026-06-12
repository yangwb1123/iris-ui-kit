import { markdownToHtml } from '../core'

export { markdownTokens, markdownPlugin } from '../core'

export interface IrisMarkdownProps {
  /** Markdown text to render. */
  content: string
  className?: string
}

/**
 * Render Markdown as themed HTML (React).
 *
 * The `content` prop is converted via `markdownToHtml` (zero dependencies,
 * script/javascript: sanitised) and injected into a `<div data-iris-markdown>`
 * using `dangerouslySetInnerHTML`. Themed via CSS custom properties:
 * `--iris-md-font` and `--iris-md-code-bg`.
 */
export function IrisMarkdown({ content, className }: IrisMarkdownProps) {
  const html = markdownToHtml(content)
  return (
    <div
      data-iris-markdown=""
      className={className}
      style={{
        fontFamily: 'var(--iris-md-font)',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

import type { JSX } from 'solid-js'
import { markdownToHtml } from '../core'

export { markdownTokens, markdownPlugin } from '../core'

export interface IrisMarkdownProps {
  /** Markdown text to render. */
  content: string
  class?: string
  style?: JSX.CSSProperties
}

/**
 * Render Markdown as themed HTML (SolidJS).
 *
 * Uses `innerHTML` (Solid's safe equivalent of dangerouslySetInnerHTML) with
 * the sanitized output of `markdownToHtml`. Themed via CSS custom properties.
 */
export function IrisMarkdown(props: IrisMarkdownProps) {
  return (
    <div
      data-iris-markdown=""
      class={props.class}
      style={{ 'font-family': 'var(--iris-md-font)', ...props.style }}
      innerHTML={markdownToHtml(props.content)}
    />
  )
}

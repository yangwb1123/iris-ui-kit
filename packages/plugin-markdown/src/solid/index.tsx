import { For, type JSX } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { markdownToNodes, type MarkdownNode } from '../core'

export {
  markdownToHtml,
  markdownToNodes,
  markdownTokens,
  markdownPlugin,
  type MarkdownNode,
} from '../core'

export interface IrisMarkdownProps {
  /** Markdown text to render. */
  content: string
  class?: string
  style?: JSX.CSSProperties
}

/**
 * Render Markdown as allowlisted Solid elements without an `innerHTML` sink.
 */
export function IrisMarkdown(props: IrisMarkdownProps) {
  const renderNode = (node: MarkdownNode): JSX.Element => {
    if (node.type === 'text') return node.value
    if (node.children.length === 0) return <Dynamic component={node.tag} {...node.attrs} />
    return (
      <Dynamic component={node.tag} {...node.attrs}>
        <For each={node.children}>{renderNode}</For>
      </Dynamic>
    )
  }
  return (
    <div
      data-iris-markdown=""
      class={props.class}
      style={{ 'font-family': 'var(--iris-md-font)', ...props.style }}
    >
      <For each={markdownToNodes(props.content)}>{renderNode}</For>
    </div>
  )
}

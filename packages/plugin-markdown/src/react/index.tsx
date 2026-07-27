import { createElement, type ReactNode } from 'react'
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
  className?: string
}

/**
 * Render Markdown as allowlisted React elements. No `innerHTML` sink is used:
 * core emits structured nodes and this thin adapter maps them to React nodes.
 */
export function IrisMarkdown({ content, className }: IrisMarkdownProps) {
  const renderNode = (node: MarkdownNode, key: string): ReactNode => {
    if (node.type === 'text') return node.value
    const attrs: Record<string, string> = {}
    for (const [name, value] of Object.entries(node.attrs)) {
      attrs[name === 'class' ? 'className' : name] = value
    }
    const children = node.children.map((child, index) => renderNode(child, `${key}.${index}`))
    return createElement(node.tag, { ...attrs, key }, ...children)
  }
  const nodes = markdownToNodes(content)
  return (
    <div data-iris-markdown="" className={className} style={{ fontFamily: 'var(--iris-md-font)' }}>
      {nodes.map((node, index) => renderNode(node, String(index)))}
    </div>
  )
}

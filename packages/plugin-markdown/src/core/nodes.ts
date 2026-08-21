import {
  ALLOWED_TAGS,
  MARKDOWN_ALLOWED_TAGS,
  safeFromCodePoint,
  type MarkdownTag,
} from './sanitizer'

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

/** Parse the converter's allowlisted HTML into framework-neutral render nodes. */
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

/** Exported for consumers that need to reason about the node tag vocabulary. */
export { MARKDOWN_ALLOWED_TAGS }

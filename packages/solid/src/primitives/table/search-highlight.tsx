import { splitSearchHits } from '@iris-ui-kit/core'
import type { JSX } from 'solid-js'
import { SEARCH_HIT_STYLE } from './styles'

/**
 * Wrap string matches in inline marks while leaving all non-string display
 * nodes and fail-closed splitter results untouched.
 */
export function applySearchHighlight(node: unknown, query: string | undefined): JSX.Element {
  if (!query || typeof node !== 'string') return node as JSX.Element
  const segments = splitSearchHits(node, query)
  if (!segments) return node
  return segments.map((segment, index) =>
    index % 2 === 1 ? (
      <mark data-iris-search-hit="" style={SEARCH_HIT_STYLE}>
        {segment}
      </mark>
    ) : (
      segment
    ),
  )
}

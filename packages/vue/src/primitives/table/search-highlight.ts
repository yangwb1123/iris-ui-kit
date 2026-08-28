import { splitSearchHits } from '@iris-ui-kit/core'
import { h } from 'vue'

const SEARCH_HIT_STYLE = {
  background: 'var(--iris-surface-selected, rgba(99,102,241,0.12))',
  color: 'inherit',
  borderRadius: 'var(--iris-radius-sm, 4px)',
  padding: '0 var(--iris-space-xxs, 4px)',
}

/** Batch CK: wrap only string display values in token-styled search marks. */
export function applySearchHighlight(node: unknown, query: string | undefined): unknown {
  if (!query || typeof node !== 'string') return node
  const text = String(node)
  const segments = splitSearchHits(text, query)
  if (!segments) return node
  return segments.map((segment, index) =>
    index % 2 === 1
      ? h(
          'mark',
          {
            key: index,
            'data-iris-search-hit': '',
            style: SEARCH_HIT_STYLE,
          },
          segment,
        )
      : segment,
  )
}

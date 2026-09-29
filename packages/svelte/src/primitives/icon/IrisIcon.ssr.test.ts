// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import { createIconRegistry } from '@iris-ui-kit/icons'
import IrisIcon from './IrisIcon.svelte'

const SVG_NS = 'http://www.w3.org/2000/svg'

const nestedRegistry = createIconRegistry({
  sets: [
    {
      name: 'nested',
      icons: {
        nested: {
          name: 'nested',
          nodes: [
            {
              tag: 'g',
              attrs: { opacity: '0.5' },
              children: [{ tag: 'path', attrs: { d: 'M0 0L1 1z' } }],
            },
          ],
        },
      },
    },
  ],
})

describe('@iris-ui-kit/svelte IrisIcon SSR', () => {
  it('renders nested structured nodes as namespaced SVG markup', () => {
    const { body } = render(IrisIcon, { props: { name: 'nested', registry: nestedRegistry } })
    expect(body).toContain(`<g opacity="0.5" xmlns="${SVG_NS}">`)
    expect(body).toContain(`<path d="M0 0L1 1z" xmlns="${SVG_NS}">`)
  })
})

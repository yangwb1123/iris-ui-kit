import { describe, expect, it } from 'vitest'
import { parseIconifyBody } from './iconify-provider-svg'
import { IconifyProviderError } from './iconify-provider-errors'

const parse = (body: string) => parseIconifyBody(body, 'test:reference')

describe('Iconify definition ownership and reference validation', () => {
  it('resolves forward references outside and inside definitions', () => {
    const body =
      '<rect fill="url(#paint)" mask="url(#outer)"/>' +
      '<defs><mask id="outer" mask="url(#inner)"><rect/></mask>' +
      '<mask id="inner"><rect fill="url(#paint)"/></mask>' +
      '<linearGradient id="paint"><stop offset="0" stop-color="#fff"/></linearGradient></defs>'
    expect(parse(body)).toHaveLength(2)
  })

  it('does not attribute nested-definition references to their parent', () => {
    // inner -> outer is valid. Attributing inner's dependency to outer as well
    // would invent an outer -> outer cycle and reject safe SVG.
    const body =
      '<defs><mask id="outer"><defs><mask id="inner" mask="url(#outer)">' +
      '<rect/></mask></defs><rect/></mask></defs><rect mask="url(#inner)"/>'
    expect(parse(body)).toHaveLength(2)
  })

  it.each(['fill', 'stroke', 'clip-path', 'mask'])('rejects incompatible %s targets', (attr) => {
    const definition = attr === 'mask' ? '<linearGradient id="target"/>' : '<mask id="target"/>'
    expect(() => parse(`<defs>${definition}</defs><rect ${attr}="url(#target)"/>`)).toThrow(
      'unresolved or incompatible SVG reference "target"',
    )
  })

  it.each([
    '<defs><mask id="a" mask="url(#a)"/></defs><rect mask="url(#a)"/>',
    '<defs><mask id="a" mask="url(#b)"/><mask id="b" mask="url(#a)"/></defs><rect mask="url(#a)"/>',
  ])('rejects self and multi-definition cycles', (body) => {
    expect(() => parse(body)).toThrow('cyclic SVG definitions')
  })

  it('retains id-error precedence over an earlier unresolved reference', () => {
    const body = '<rect fill="url(#missing)"/><defs><mask id="same"/><mask id="same"/></defs>'
    expect(() => parse(body)).toThrow('duplicate SVG id "same"')
  })

  it('retains depth/node bounds when collecting references', () => {
    for (const body of ['<g>'.repeat(18) + '<rect/>' + '</g>'.repeat(18), '<rect/>'.repeat(513)]) {
      try {
        parse(body)
        throw new Error('expected rejection')
      } catch (error) {
        expect(error).toBeInstanceOf(IconifyProviderError)
        expect((error as IconifyProviderError).code).toBe('limit-exceeded')
      }
    }
  })
})

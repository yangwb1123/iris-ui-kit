import { describe, expect, it } from 'vitest'
import { createIconifyProvider, normalizeIconNodes } from './index'

async function remoteIcon(body: string) {
  const provider = createIconifyProvider({
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ prefix: 'test', icons: { icon: { body } } }),
    }),
  })
  return provider.loadIcon('test:icon')
}

describe('shared SVG predicates retain consumer-specific safety contracts', () => {
  it('preserves renderer metadata and filters unsafe scalar values', () => {
    const result = normalizeIconNodes([
      {
        tag: 'path',
        attrs: {
          d: 'M0 0z',
          'data-probe': 'metadata',
          'aria-label': 'Name',
          r: Number.NaN,
          cx: Number.POSITIVE_INFINITY,
          fill: 'url(https://invalid.test/icon)',
          transform: 'translate(1);evil()',
        },
      },
    ])
    expect(result[0]?.attrs).toEqual({ d: 'M0 0z', 'data-probe': 'metadata', 'aria-label': 'Name' })
  })

  it('keeps the legacy clip-rule renderer enum/provider numeric distinction', async () => {
    expect(
      normalizeIconNodes([{ tag: 'path', attrs: { d: 'M0 0z', 'clip-rule': 'evenodd' } }])[0]
        ?.attrs['clip-rule'],
    ).toBe('evenodd')
    expect(
      normalizeIconNodes([{ tag: 'path', attrs: { d: 'M0 0z', 'clip-rule': '1' } }])[0]?.attrs[
        'clip-rule'
      ],
    ).toBeUndefined()
    await expect(remoteIcon('<path d="M0 0z" clip-rule="evenodd"/>')).rejects.toMatchObject({
      code: 'unsafe-icon',
    })
    expect((await remoteIcon('<path d="M0 0z" clip-rule="1"/>')).nodes[0]?.attrs['clip-rule']).toBe(
      '1',
    )
  })

  it.each([
    ['transform', 'translate(1)'.repeat(50), 'unsafe-icon'],
    ['d', 'M0 0z'.repeat(7_000), 'limit-exceeded'],
    ['points', '1,2 '.repeat(9_000), 'limit-exceeded'],
  ])('retains %s length bounds for both consumers', async (name, value, code) => {
    const nodes = normalizeIconNodes([{ tag: 'path', attrs: { [name]: value } }])
    expect(nodes[0]?.attrs[name]).toBeUndefined()
    const tag = name === 'points' ? 'polygon' : 'path'
    await expect(remoteIcon(`<${tag} ${name}="${value}"/>`)).rejects.toMatchObject({ code })
  })
})

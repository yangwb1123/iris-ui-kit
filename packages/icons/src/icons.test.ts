import { describe, expect, it } from 'vitest'
import { defaultIcons } from './icons'
import { createIconRegistry, defaultIconRegistry, resolveIcon } from './registry'
import { renderIconSvg } from './render'
import { resolveThemedIcon } from './theme'
import type { IrisIcon, IrisIconSet } from './types'

describe('@iris-ui/icons defaultIcons', () => {
  it('ships a non-trivial set with well-formed structured entries', () => {
    const names = Object.keys(defaultIcons.icons)
    expect(names.length).toBeGreaterThanOrEqual(20)
    for (const name of names) {
      const icon = defaultIcons.icons[name]!
      expect(icon.name).toBe(name)
      expect(icon.nodes.length).toBeGreaterThan(0)
      for (const node of icon.nodes) {
        expect(node.tag.length).toBeGreaterThan(0)
        expect(typeof node.attrs).toBe('object')
      }
    }
  })

  it('includes the glyphs the primitives rely on', () => {
    for (const name of ['check', 'x', 'chevron-down', 'search', 'calendar', 'eye']) {
      expect(defaultIcons.icons[name]).toBeDefined()
    }
  })
})

describe('@iris-ui/icons registry', () => {
  it('default registry resolves an icon by name', () => {
    const icon = defaultIconRegistry.resolve('check')
    expect(icon).toBeDefined()
    expect(icon!.name).toBe('check')
    expect(icon!.nodes[0]!.tag).toBe('polyline')
  })

  it('resolveIcon is a shortcut over the default registry', () => {
    expect(resolveIcon('x')).toEqual(defaultIconRegistry.resolve('x'))
  })

  it('has() reflects resolvability', () => {
    expect(defaultIconRegistry.has('check')).toBe(true)
    expect(defaultIconRegistry.has('definitely-not-an-icon')).toBe(false)
  })

  it('list() returns the active set names', () => {
    expect(defaultIconRegistry.list()).toEqual(Object.keys(defaultIcons.icons))
  })

  it('unknown names resolve to undefined', () => {
    expect(defaultIconRegistry.resolve('nope')).toBeUndefined()
  })

  it('switches active set via use(); throws on unknown set', () => {
    const extra: IrisIconSet = {
      name: 'extra',
      icons: { star: { name: 'star', nodes: [{ tag: 'path', attrs: { d: 'M1 1' } }] } },
    }
    const reg = createIconRegistry({ sets: [defaultIcons, extra] })
    expect(reg.has('star')).toBe(false) // default set active first
    reg.use('extra')
    expect(reg.has('star')).toBe(true)
    expect(reg.has('check')).toBe(false)
    expect(() => reg.use('ghost')).toThrow(/not registered/)
  })

  it('per-icon overrides take precedence over the active set', () => {
    const reg = createIconRegistry({ sets: [defaultIcons] })
    const custom: IrisIcon = { name: 'check', nodes: [{ tag: 'path', attrs: { d: 'M0 0' } }] }
    reg.setOverrides({ check: custom })
    expect(reg.resolve('check')).toBe(custom)
    reg.setOverrides(undefined)
    expect(reg.resolve('check')!.nodes[0]!.tag).toBe('polyline')
  })

  it('register() adds a set and activates the first one', () => {
    const reg = createIconRegistry()
    expect(reg.list()).toEqual([])
    reg.register({ name: 'one', icons: { a: { name: 'a', nodes: [{ tag: 'path', attrs: {} }] } } })
    expect(reg.has('a')).toBe(true)
  })
})

describe('@iris-ui/icons renderIconSvg', () => {
  it('wraps nodes in an svg with viewBox + currentColor stroke', () => {
    const out = renderIconSvg(defaultIcons.icons.check!)
    expect(out.startsWith('<svg ')).toBe(true)
    expect(out).toContain('viewBox="0 0 24 24"')
    expect(out).toContain('stroke="currentColor"')
    expect(out).toContain('fill="none"')
    expect(out).toContain('width="24"')
    expect(out).toContain('<polyline points="20 6 9 17 4 12"/>')
    expect(out.endsWith('</svg>')).toBe(true)
  })

  it('honors size + strokeWidth', () => {
    const out = renderIconSvg(defaultIcons.icons.x!, { size: 16, strokeWidth: 1.5 })
    expect(out).toContain('width="16"')
    expect(out).toContain('height="16"')
    expect(out).toContain('stroke-width="1.5"')
  })

  it('fill mode drops the stroke attributes', () => {
    const out = renderIconSvg(defaultIcons.icons.folder!, { fill: true })
    expect(out).toContain('fill="currentColor"')
    expect(out).not.toContain('stroke="currentColor"')
  })

  it('title adds role="img", aria-label and a <title> element', () => {
    const out = renderIconSvg(defaultIcons.icons.search!, { title: 'Search' })
    expect(out).toContain('role="img"')
    expect(out).toContain('aria-label="Search"')
    expect(out).toContain('<title>Search</title>')
  })

  it('aria-hidden when no title', () => {
    expect(renderIconSvg(defaultIcons.icons.menu!)).toContain('aria-hidden="true"')
  })

  it('merges custom attrs', () => {
    const out = renderIconSvg(defaultIcons.icons.info!, { attrs: { class: 'ic', id: 'i1' } })
    expect(out).toContain('class="ic"')
    expect(out).toContain('id="i1"')
  })
})

describe('@iris-ui/icons getSet', () => {
  it('returns a registered set, undefined otherwise', () => {
    expect(defaultIconRegistry.getSet('iris-default')).toBe(defaultIcons)
    expect(defaultIconRegistry.getSet('nope')).toBeUndefined()
  })
})

describe('@iris-ui/icons resolveThemedIcon', () => {
  const alt: IrisIconSet = {
    name: 'alt',
    icons: { check: { name: 'check', nodes: [{ tag: 'path', attrs: { d: 'M0 0' } }] } },
  }
  const reg = createIconRegistry({ sets: [defaultIcons, alt] })

  it('with no theme behaves like registry.resolve', () => {
    expect(resolveThemedIcon(reg, 'check')).toEqual(reg.resolve('check'))
  })

  it('iconOverrides aliases a name to another icon', () => {
    const icon = resolveThemedIcon(reg, 'chevron-down', {
      iconOverrides: { 'chevron-down': 'chevron-up' },
    })
    expect(icon!.nodes[0]!.attrs.points).toBe('18 15 12 9 6 15') // chevron-up's geometry
  })

  it('icons selects a preferred set', () => {
    const icon = resolveThemedIcon(reg, 'check', { icons: 'alt' })
    expect(icon!.nodes[0]!.tag).toBe('path') // alt set's check, not the default polyline
  })

  it('falls back to normal resolution when the themed set lacks the glyph', () => {
    // 'alt' has no 'search'; should fall back to the default set.
    const icon = resolveThemedIcon(reg, 'search', { icons: 'alt' })
    expect(icon!.nodes.some((n) => n.tag === 'circle')).toBe(true)
  })

  it('unknown alias target yields undefined', () => {
    expect(resolveThemedIcon(reg, 'check', { iconOverrides: { check: 'ghost' } })).toBeUndefined()
  })
})

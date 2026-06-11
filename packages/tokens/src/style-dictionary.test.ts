import { describe, it, expect } from 'vitest'
import { lightTheme } from './light'
import { toDtcg } from './dtcg'
import { flattenDtcg, dtcgToCss, irisStyleDictionaryConfig } from './style-dictionary'

describe('flattenDtcg', () => {
  const flat = flattenDtcg(toDtcg(lightTheme))

  it('flattens every token (21) with -- css names', () => {
    expect(flat).toHaveLength(21)
    expect(flat.every((t) => t.name.startsWith('--iris-'))).toBe(true)
  })

  it('drops the DEFAULT segment for a base-with-variant token', () => {
    expect(flat.find((t) => t.path === 'iris.surface')?.name).toBe('--iris-surface')
    expect(flat.find((t) => t.path === 'iris.surface.hover')?.name).toBe('--iris-surface-hover')
  })

  it('carries value + type', () => {
    expect(flat.find((t) => t.path === 'iris.gap.sm')).toEqual({
      path: 'iris.gap.sm',
      name: '--iris-gap-sm',
      value: '4px',
      type: 'dimension',
    })
  })
})

describe('dtcgToCss', () => {
  it('emits a :root variable block', () => {
    const css = dtcgToCss(toDtcg(lightTheme))
    expect(css.startsWith(':root {')).toBe(true)
    expect(css).toContain('--iris-primary:')
    expect(css.trimEnd().endsWith('}')).toBe(true)
  })

  it('honors a custom selector', () => {
    const css = dtcgToCss(toDtcg(lightTheme), { selector: '[data-iris-theme="dark"]' })
    expect(css.startsWith('[data-iris-theme="dark"] {')).toBe(true)
  })
})

describe('irisStyleDictionaryConfig', () => {
  it('produces a SD v4 config with css/js/json platforms', () => {
    const cfg = irisStyleDictionaryConfig()
    expect(cfg.source).toEqual(['iris-light.tokens.json'])
    expect(cfg.platforms.css.files[0]).toEqual({ destination: 'iris.css', format: 'css/variables' })
    expect(cfg.platforms.js.files[0].format).toBe('javascript/es6')
    expect(cfg.platforms.json.files[0].format).toBe('json/flat')
  })

  it('threads source, buildPath, and prefix', () => {
    const cfg = irisStyleDictionaryConfig({
      source: ['a.json', 'b.json'],
      buildPath: 'out/',
      prefix: 'iris',
    })
    expect(cfg.source).toEqual(['a.json', 'b.json'])
    expect(cfg.platforms.css.buildPath).toBe('out/')
    expect(cfg.platforms.css.prefix).toBe('iris')
  })

  it('omits prefix when not requested', () => {
    expect(irisStyleDictionaryConfig().platforms.css.prefix).toBeUndefined()
  })
})

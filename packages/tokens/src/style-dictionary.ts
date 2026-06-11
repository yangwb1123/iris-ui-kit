import { type DtcgGroup, type DtcgToken, type DtcgType } from './dtcg'

/**
 * Style Dictionary / CSS-variable interop built on the DTCG export
 * ({@link toDtcg}). `flattenDtcg` + `dtcgToCss` give a dependency-free path from
 * an Iris theme to the same `css/variables` output Style Dictionary produces;
 * `irisStyleDictionaryConfig` is a ready-to-run SD v4 config for teams that want
 * the full Style Dictionary pipeline (JS/JSON/Tailwind/iOS/Android targets).
 */

/** A single resolved token, flattened out of the DTCG tree. */
export interface FlatToken {
  /** Dotted DTCG path, e.g. `iris.surface.hover` (a `DEFAULT` segment is dropped). */
  path: string
  /** CSS custom-property name, e.g. `--iris-surface-hover`. */
  name: string
  value: string
  type: DtcgType
}

const DEFAULT_KEY = 'DEFAULT'

function isToken(node: DtcgGroup | DtcgToken): node is DtcgToken {
  return typeof (node as DtcgToken).$value === 'string'
}

/**
 * Flatten a DTCG token tree into a flat list — the shape a CSS-variable /
 * Style Dictionary `css/variables` output is built from. A `DEFAULT` path
 * segment (the Tailwind-style base of a token that also has variants) is dropped
 * from both the dotted path and the CSS name.
 */
export function flattenDtcg(group: DtcgGroup): FlatToken[] {
  const out: FlatToken[] = []
  const walk = (node: DtcgGroup, trail: string[]): void => {
    for (const key of Object.keys(node)) {
      const child = node[key]
      const nextTrail = key === DEFAULT_KEY ? trail : [...trail, key]
      if (isToken(child)) {
        out.push({
          path: nextTrail.join('.'),
          name: `--${nextTrail.join('-')}`,
          value: child.$value,
          type: child.$type,
        })
      } else {
        walk(child, nextTrail)
      }
    }
  }
  walk(group, [])
  return out
}

/**
 * Render a DTCG token tree as a CSS custom-property block — the same output
 * Style Dictionary's `css/variables` format produces, but dependency-free so
 * Iris can emit it without Style Dictionary installed.
 */
export function dtcgToCss(group: DtcgGroup, opts?: { selector?: string }): string {
  const selector = opts?.selector ?? ':root'
  const body = flattenDtcg(group)
    .map((t) => `  ${t.name}: ${t.value};`)
    .join('\n')
  return `${selector} {\n${body}\n}\n`
}

/** A platform entry in a Style Dictionary config. */
export interface StyleDictionaryPlatform {
  transformGroup: string
  prefix?: string
  buildPath: string
  files: { destination: string; format: string }[]
}

/** A minimal Style Dictionary v4 config (`source` + `platforms`). */
export interface StyleDictionaryConfig {
  source: string[]
  platforms: Record<string, StyleDictionaryPlatform>
}

/**
 * Build a ready-to-run Style Dictionary v4 config that consumes the DTCG token
 * files emitted by {@link toDtcgJson} and produces CSS variables, an ES module,
 * and flat JSON. Write `toDtcgJson(lightTheme)` to `source[0]`, drop this object
 * in a `style-dictionary.config.json`, then run `style-dictionary build`.
 */
export function irisStyleDictionaryConfig(opts?: {
  source?: string[]
  buildPath?: string
  prefix?: string
}): StyleDictionaryConfig {
  const source = opts?.source ?? ['iris-light.tokens.json']
  const buildPath = opts?.buildPath ?? 'build/'
  const prefix = opts?.prefix
  const platform = (
    transformGroup: string,
    destination: string,
    format: string,
  ): StyleDictionaryPlatform => {
    const p: StyleDictionaryPlatform = {
      transformGroup,
      buildPath,
      files: [{ destination, format }],
    }
    if (prefix !== undefined) p.prefix = prefix
    return p
  }
  return {
    source,
    platforms: {
      css: platform('css', 'iris.css', 'css/variables'),
      js: platform('js', 'iris.js', 'javascript/es6'),
      json: platform('js', 'iris.tokens.json', 'json/flat'),
    },
  }
}

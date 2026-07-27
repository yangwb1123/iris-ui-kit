// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface PackageJson {
  exports: Record<string, unknown>
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
) as PackageJson

describe('@iris-ui-kit/svelte package exports', () => {
  it('maps every public top-level source barrel to its packaged subpath', () => {
    const sourceRoot = join(packageRoot, 'src')
    const publicBarrels = readdirSync(sourceRoot, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.name.startsWith('__') &&
          existsSync(join(sourceRoot, entry.name, 'index.ts')),
      )
      .map((entry) => entry.name)

    expect(publicBarrels).toEqual(
      expect.arrayContaining([
        'admin',
        'async',
        'behaviors',
        'data',
        'error-boundary',
        'floating',
        'form',
        'i18n',
        'layouts',
        'motion',
        'provider',
        'resource',
        'skeletons',
        'skins',
        'theme',
        'undo',
      ]),
    )
    for (const barrel of publicBarrels) {
      expect(packageJson.exports[`./${barrel}`]).toEqual({
        types: `./dist/${barrel}/index.d.ts`,
        svelte: `./dist/${barrel}/index.js`,
        default: `./dist/${barrel}/index.js`,
      })
    }
  })
})

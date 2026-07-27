// Generate DTCG token files + a Style Dictionary config from the Iris themes.
// Run after building the package:  pnpm --filter @iris-ui-kit/tokens tokens:build
//
// Outputs (under dist/tokens/, a build artifact — not committed):
//   iris-light.tokens.json     DTCG token document for the light theme
//   iris-dark.tokens.json      DTCG token document for the dark theme
//   style-dictionary.config.json  ready-to-run Style Dictionary v4 config
//
// Then, with style-dictionary installed:
//   cd dist/tokens && npx style-dictionary build --config style-dictionary.config.json
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  lightTheme,
  darkTheme,
  toDtcgJson,
  irisStyleDictionaryConfig,
} from '../dist/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'dist', 'tokens')
mkdirSync(outDir, { recursive: true })

writeFileSync(join(outDir, 'iris-light.tokens.json'), toDtcgJson(lightTheme) + '\n')
writeFileSync(join(outDir, 'iris-dark.tokens.json'), toDtcgJson(darkTheme) + '\n')

const config = irisStyleDictionaryConfig({
  source: ['iris-light.tokens.json'],
  buildPath: 'build/',
  prefix: 'iris',
})
writeFileSync(
  join(outDir, 'style-dictionary.config.json'),
  JSON.stringify(config, null, 2) + '\n',
)

console.log('Wrote DTCG tokens + Style Dictionary config to', outDir)

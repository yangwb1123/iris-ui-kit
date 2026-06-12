import { parseArgs } from 'node:util'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import type { Framework, IrisManifest } from '@iris-ui/manifest'
import { runList } from './commands/list.js'
import { runScaffold } from './commands/scaffold.js'

// ---------------------------------------------------------------------------
// Manifest loader (mirrors packages/mcp/src/manifest-source.ts)
// ---------------------------------------------------------------------------

export function loadManifest(): IrisManifest {
  const require = createRequire(import.meta.url)
  const path = require.resolve('@iris-ui/manifest/manifest.json')
  return JSON.parse(readFileSync(path, 'utf8')) as IrisManifest
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

const USAGE = `
Usage:
  iris-ui list [--group=<group>]
  iris-ui scaffold <ComponentName> [--framework=react|vue|solid|svelte]

Commands:
  list        List all available components (optionally filter by group)
  scaffold    Print a ready-to-paste import + usage snippet

Options:
  --group       Filter list output to a specific group
  --framework   Target framework (default: react)
  --help, -h    Show this help text
`.trimStart()

function main(): void {
  const argv = process.argv.slice(2)

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    process.stdout.write(USAGE)
    process.exit(0)
  }

  const command = argv[0]
  const rest = argv.slice(1)

  if (command === 'list') {
    const { values } = parseArgs({
      args: rest,
      options: {
        group: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: false,
    })
    if (values['help']) {
      process.stdout.write('Usage: iris-ui list [--group=<group>]\n')
      process.exit(0)
    }
    const manifest = loadManifest()
    process.exit(runList(manifest, values['group'] as string | undefined))
  }

  if (command === 'scaffold') {
    const { values, positionals } = parseArgs({
      args: rest,
      options: {
        framework: { type: 'string', default: 'react' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
      strict: false,
    })
    if (values['help']) {
      process.stdout.write(
        'Usage: iris-ui scaffold <ComponentName> [--framework=react|vue|solid|svelte]\n',
      )
      process.exit(0)
    }
    const componentName = positionals[0]
    if (!componentName) {
      process.stderr.write('Error: <ComponentName> is required.\n')
      process.exit(1)
    }
    const framework = (values['framework'] ?? 'react') as Framework
    const manifest = loadManifest()
    process.exit(runScaffold(manifest, componentName, framework))
  }

  process.stderr.write(`Error: unknown command "${command}".\n\n${USAGE}`)
  process.exit(1)
}

main()

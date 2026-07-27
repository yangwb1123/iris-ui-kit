import { parseArgs } from 'node:util'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import type { Framework, IrisManifest } from '@iris-ui-kit/manifest'
import { runList } from './commands/list.js'
import { runScaffold } from './commands/scaffold.js'
import { runCodemodList, runCodemodRun } from './commands/codemod.js'
import { runAdd, runDiff, runInit, runRegistryAdd, runUpdate } from './commands/registry.js'

// ---------------------------------------------------------------------------
// Manifest loader (mirrors packages/mcp/src/manifest-source.ts)
// ---------------------------------------------------------------------------

export function loadManifest(): IrisManifest {
  const require = createRequire(import.meta.url)
  const path = require.resolve('@iris-ui-kit/manifest/manifest.json')
  return JSON.parse(readFileSync(path, 'utf8')) as IrisManifest
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

const USAGE = `
Usage:
  iris-ui list [--group=<group>]
  iris-ui scaffold <ComponentName> [--framework=react|vue|solid|svelte]
  iris-ui init [--framework=react|vue|solid|svelte] [--force]
  iris-ui registry add <name> <catalog-url-or-path>
  iris-ui add <item...> [--registry=<name>] [--force] [--dry-run]
  iris-ui diff <item...> [--registry=<name>]
  iris-ui update [item...] [--registry=<name>]
  iris-ui codemod list
  iris-ui codemod run <name> <glob-or-path> [--dry-run]

Commands:
  list        List all available components (optionally filter by group)
  scaffold    Print a ready-to-paste import + usage snippet
  init        Create iris.json and iris.lock.json
  registry    Add a named source registry
  add         Install framework-specific source files from a registry
  diff        Preview source registry changes without writing
  update      Update installed items (all locked items when names are omitted)
  codemod     List or run a registered source-text migration for a breaking change

Options:
  --group       Filter list output to a specific group
  --framework   Target framework (default: react)
  --dry-run     Preview codemod changes without writing files
  --registry    Select a configured source registry (default: iris)
  --force       Allow replacing an unmanaged file
  --help, -h    Show this help text
`.trimStart()

function isHelpRequest(argv: string[]): boolean {
  return argv.length === 0 || argv[0] === '--help' || argv[0] === '-h'
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)

  if (isHelpRequest(argv)) {
    process.stdout.write(USAGE)
    process.exit(0)
  }

  const command = argv[0]
  const rest = argv.slice(1)

  if (command === 'list') {
    runListCommand(rest)
  }

  if (command === 'scaffold') {
    runScaffoldCommand(rest)
  }

  if (command === 'init') {
    runInitCommand(rest)
  }

  if (command === 'registry') {
    runRegistryCommand(rest)
  }

  if (command === 'add' || command === 'diff' || command === 'update') {
    await runRegistryItemCommand(command, rest)
  }

  if (command === 'codemod') {
    runCodemodCommand(rest)
  }

  process.stderr.write(`Error: unknown command "${command}".\n\n${USAGE}`)
  process.exit(1)
}

function runCodemodCommand(rest: string[]): void {
  const sub = rest[0]
  const subRest = rest.slice(1)

  if (sub === 'list') {
    process.exit(runCodemodList())
  }

  if (sub === 'run') {
    const { values, positionals } = parseArgs({
      args: subRest,
      options: {
        'dry-run': { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
      strict: false,
    })
    if (values['help']) {
      process.stdout.write('Usage: iris-ui codemod run <name> <glob-or-path> [--dry-run]\n')
      process.exit(0)
    }
    const name = positionals[0]
    const target = positionals[1]
    if (!name || !target) {
      process.stderr.write('Error: <name> and <glob-or-path> are required.\n')
      process.exit(1)
    }
    process.exit(runCodemodRun(name, target, { dryRun: Boolean(values['dry-run']) }))
  }

  process.stderr.write(
    `Error: unknown codemod subcommand "${sub}".\n\n` +
      'Usage:\n  iris-ui codemod list\n  iris-ui codemod run <name> <glob-or-path> [--dry-run]\n',
  )
  process.exit(1)
}

function runListCommand(rest: string[]): never {
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
  process.exit(runList(loadManifest(), values['group'] as string | undefined))
}

function runScaffoldCommand(rest: string[]): never {
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
  process.exit(runScaffold(loadManifest(), componentName, framework))
}

function runInitCommand(rest: string[]): never {
  const { values } = parseArgs({
    args: rest,
    options: {
      framework: { type: 'string', default: 'react' },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    strict: false,
  })
  if (values['help']) {
    process.stdout.write('Usage: iris-ui init [--framework=react|vue|solid|svelte] [--force]\n')
    process.exit(0)
  }
  process.exit(
    runInit({
      framework: (values['framework'] ?? 'react') as Framework,
      force: Boolean(values['force']),
    }),
  )
}

function runRegistryCommand(rest: string[]): never {
  const sub = rest[0]
  if (sub !== 'add' || !rest[1] || !rest[2]) {
    process.stderr.write('Usage: iris-ui registry add <name> <catalog-url-or-path>\n')
    process.exit(1)
  }
  process.exit(runRegistryAdd(rest[1], rest[2]))
}

async function runRegistryItemCommand(
  command: 'add' | 'diff' | 'update',
  rest: string[],
): Promise<never> {
  const { values, positionals } = parseArgs({
    args: rest,
    options: {
      registry: { type: 'string' },
      force: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    strict: false,
  })
  if (values['help']) {
    process.stdout.write(
      `Usage: iris-ui ${command} ${command === 'update' ? '[item...]' : '<item...>'} [--registry=<name>]${command === 'add' ? ' [--force] [--dry-run]' : ''}\n`,
    )
    process.exit(0)
  }
  const registry = values['registry'] as string | undefined
  if (command === 'add') {
    process.exit(
      await runAdd(positionals, {
        registry,
        force: Boolean(values['force']),
        dryRun: Boolean(values['dry-run']),
      }),
    )
  }
  if (command === 'diff') process.exit(await runDiff(positionals, { registry }))
  process.exit(await runUpdate(positionals, { registry }))
}

void main()

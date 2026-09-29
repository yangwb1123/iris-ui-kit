import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const registryRoot = resolve(root, 'registry')

const readText = (path) => readFileSync(path, 'utf8')
const readJson = (path) => JSON.parse(readText(path))
const digest = (content) => `sha256-${createHash('sha256').update(content).digest('hex')}`

// `--update` refreshes the catalog digests instead of failing on them.
//
// Why it exists: the catalog stores a SHA-256 of every item file, and *any*
// formatter run over registry/ (lint-staged runs Prettier on staged JSON) can
// rewrite those bytes. The stale digest then surfaces much later as
// "Integrity check failed for registry item …" from the CLI's `add` command —
// three steps removed from the thing that actually broke. Refresh explicitly,
// then let the same assertions re-verify.
const UPDATE = process.argv.includes('--update')

/**
 * Rewrite the `integrity` field of every catalog entry to match its file.
 *
 * The edit is *surgical* on purpose: the file is re-serialized only if the
 * digest text changes, never reformatted wholesale. Re-serializing would make
 * Prettier reformat the JSON, whose bytes are the digest input — the tool would
 * then invalidate the very digest it just wrote.
 *
 * @returns {string[]} human-readable list of what changed
 */
function refreshIntegrity(catalogPath, listKey) {
  const catalog = readJson(catalogPath)
  const entries = catalog[listKey] ?? []
  let text = readText(catalogPath)
  const changed = []
  for (const [index, entry] of entries.entries()) {
    const target = resolveRegistryReference(catalogPath, entry.url)
    if (!existsSync(target)) continue
    const next = digest(readText(target))
    if (entry.integrity === next) continue
    // Replace the Nth `integrity` occurrence, so entry order maps to file order.
    let seen = -1
    text = text.replace(/"integrity": "sha256-[a-f0-9]{64}"/g, (match) => {
      seen += 1
      return seen === index ? `"integrity": "${next}"` : match
    })
    changed.push(`${listKey}/${entry.name} -> ${next.slice(0, 20)}…`)
  }
  if (changed.length > 0) writeFileSync(catalogPath, text)
  return changed
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function resolveRegistryReference(documentPath, reference) {
  const path = resolve(dirname(documentPath), reference)
  assert(
    path === registryRoot || path.startsWith(`${registryRoot}/`),
    `Registry reference escapes registry/: ${reference}`,
  )
  return path
}

function assertIntegrity(documentPath, integrity, label) {
  assert(/^sha256-[a-f\d]{64}$/i.test(integrity ?? ''), `${label} must declare sha256 integrity`)
  assert(digest(readText(documentPath)) === integrity, `${label} integrity is stale`)
}

function assertDependencyVersions(item) {
  const groups = [item.dependencies ?? {}, ...Object.values(item.dependenciesByFramework ?? {})]
  for (const dependencies of groups) {
    for (const [name, range] of Object.entries(dependencies)) {
      if (!name.startsWith('@iris-ui-kit/')) continue
      const packageDirectory = name.slice('@iris-ui-kit/'.length)
      const pkg = readJson(resolve(root, 'packages', packageDirectory, 'package.json'))
      assert(
        range === `^${pkg.version}`,
        `${item.name} depends on ${name}@${range}, expected ^${pkg.version}`,
      )
    }
  }
}

function validateSourceRegistry() {
  const catalogPath = resolve(registryRoot, 'registry.json')
  const catalog = readJson(catalogPath)
  assert(catalog.schema === 'iris-ui/registry@1', 'Unsupported source registry schema')
  assert(Array.isArray(catalog.items), 'Source registry items must be an array')
  for (const entry of catalog.items) {
    const itemPath = resolveRegistryReference(catalogPath, entry.url)
    assertIntegrity(itemPath, entry.integrity, `registry item ${entry.name}`)
    const item = readJson(itemPath)
    assert(
      item.name === entry.name && item.type === entry.type && item.version === entry.version,
      `Registry identity mismatch for ${entry.name}`,
    )
    assertDependencyVersions(item)
    for (const file of item.files ?? []) {
      if (typeof file.content === 'string') {
        assert(
          !file.integrity || digest(file.content) === file.integrity,
          `${entry.name}/${file.target} inline integrity is stale`,
        )
        continue
      }
      assert(typeof file.source === 'string', `${entry.name}/${file.target} has no source`)
      const sourcePath = resolveRegistryReference(itemPath, file.source)
      assertIntegrity(sourcePath, file.integrity, `${entry.name}/${file.source}`)
    }
  }
  return catalog.items.length
}

function validateMarketplace() {
  const manifestPath = resolve(registryRoot, 'marketplace/manifest.json')
  const manifest = readJson(manifestPath)
  assert(manifest.schema === 'iris-ui/marketplace@1', 'Unsupported marketplace schema')
  assert(Array.isArray(manifest.resources), 'Marketplace resources must be an array')
  for (const entry of manifest.resources) {
    const payloadPath = resolveRegistryReference(manifestPath, entry.url)
    assertIntegrity(payloadPath, entry.integrity, `marketplace resource ${entry.name}`)
    const payload = readJson(payloadPath)
    assert(
      payload.name === entry.name &&
        payload.type === entry.type &&
        payload.version === entry.version,
      `Marketplace identity mismatch for ${entry.name}`,
    )
  }
  return manifest.resources.length
}

let sourceCount
let marketplaceCount
try {
  if (UPDATE) {
    const refreshed = [
      ...refreshIntegrity(resolve(registryRoot, 'registry.json'), 'items'),
      ...refreshIntegrity(resolve(registryRoot, 'marketplace/manifest.json'), 'resources'),
    ]
    process.stdout.write(
      refreshed.length === 0
        ? 'registry integrity already up to date (no catalog digest rewritten)\n'
        : `registry integrity refreshed:\n${refreshed.map((line) => `  ${line}`).join('\n')}\n`,
    )
  }

  sourceCount = validateSourceRegistry()
  marketplaceCount = validateMarketplace()
} catch (error) {
  process.stderr.write(
    `Registry validation failed: ${error.message}\n` +
      // A stale digest is the failure a formatter run can cause silently, so
      // name the one command that fixes it instead of leaving the reader to
      // guess (the same instinct as check-doc-facts --write).
      (error.message.includes('integrity is stale')
        ? 'Hint: run `pnpm check:registry:fix` to refresh the catalog digests.\n'
        : ''),
  )
  process.exit(1)
}

const checks = [
  ['node_modules/.bin/tsc', ['-p', 'registry/tsconfig.react.json']],
  ['node_modules/.bin/tsc', ['-p', 'registry/tsconfig.solid.json']],
  ['apps/cms/node_modules/.bin/vue-tsc', ['-p', 'registry/tsconfig.vue.json', '--noEmit']],
  [
    'packages/svelte/node_modules/.bin/svelte-check',
    ['--workspace', 'registry/templates/admin-layout/svelte', '--tsconfig', './tsconfig.json'],
  ],
]

for (const [command, args] of checks) {
  const result = spawnSync(resolve(root, command), args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

process.stdout.write(
  `Registry: ${sourceCount} source item(s), ${marketplaceCount} runtime resource(s), dependency ranges, integrity, identity, and react/vue/solid/svelte template compilation passed.\n`,
)

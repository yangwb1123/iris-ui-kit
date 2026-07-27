import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const registryRoot = resolve(root, 'registry')

const readText = (path) => readFileSync(path, 'utf8')
const readJson = (path) => JSON.parse(readText(path))
const digest = (content) => `sha256-${createHash('sha256').update(content).digest('hex')}`

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
  sourceCount = validateSourceRegistry()
  marketplaceCount = validateMarketplace()
} catch (error) {
  process.stderr.write(`Registry validation failed: ${error.message}\n`)
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

#!/usr/bin/env node
/* global console */
// External-consumer pack+install smoke check. Every demo app in this repo
// consumes these packages via the pnpm workspace protocol ("workspace:*"),
// which only ever resolves through pnpm's own path/symlink machinery — no
// package has ever actually been installed the way a real external npm
// consumer would (a plain tarball dependency, outside any workspace). This
// auto-discovers EVERY non-private package, installs their real tarballs via
// plain `npm install` into a scratch project OUTSIDE the pnpm workspace, then
// validates all explicit exports and imports each precompiled JS subpath.
// Raw Svelte entries are checked structurally; the CLI bin is executed. Run
// after the complete build:
//
//   pnpm turbo run build
//   pnpm check:pack-install
//
// Zero deps: node:fs/os/path/url + child_process (pnpm/npm/node CLIs).
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const packagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages')
const workspaceRoot = dirname(packagesDir)
const canonicalLicense = readFileSync(join(workspaceRoot, 'LICENSE'), 'utf8')
const readPkg = (dir) => JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8'))
const pinnedInstalledPackage = (...segments) => {
  const pkg = JSON.parse(readFileSync(join(workspaceRoot, ...segments, 'package.json'), 'utf8'))
  return [pkg.name, pkg.version]
}

// The scratch directory is a real consumer project, so its compiler, framework
// peers, and ambient types must resolve from the same node_modules tree as the
// packed Iris packages. Pin them to the exact versions already selected by the
// workspace lockfile: npm can reuse its cache, while the gate cannot silently
// drift to a newer consumer toolchain between runs.
const CONSUMER_RUNTIME_DEPENDENCIES = Object.fromEntries([
  pinnedInstalledPackage('packages', 'react', 'node_modules', 'react'),
  pinnedInstalledPackage('packages', 'react', 'node_modules', 'react-dom'),
  pinnedInstalledPackage('packages', 'solid', 'node_modules', 'solid-js'),
  pinnedInstalledPackage('packages', 'svelte', 'node_modules', 'svelte'),
  pinnedInstalledPackage('packages', 'vue', 'node_modules', 'vue'),
])
const CONSUMER_DEV_DEPENDENCIES = Object.fromEntries([
  pinnedInstalledPackage('node_modules', 'typescript'),
  pinnedInstalledPackage('node_modules', 'eslint'),
  pinnedInstalledPackage('node_modules', '@types', 'node'),
  pinnedInstalledPackage('packages', 'react', 'node_modules', '@types', 'react'),
  pinnedInstalledPackage('packages', 'react', 'node_modules', '@types', 'react-dom'),
  pinnedInstalledPackage('packages', 'svelte', 'node_modules', 'svelte-check'),
])

// Discover instead of hand-maintaining: adding a publishable package without
// adding it to this gate must be impossible. Private workspace-only packages
// are intentionally excluded.
const PUBLISHABLE = readdirSync(packagesDir)
  .filter((dir) => existsSync(join(packagesDir, dir, 'package.json')))
  .filter((dir) => readPkg(dir).private !== true)
  .sort()

// npm provenance verifies each published package's repository metadata against
// the GitHub Actions source repository. Keep this exact so a repository move
// cannot pass pack-install and then fail every publish with E422.
const EXPECTED_REPOSITORY_URL = 'https://github.com/yangwb1123/iris-ui-kit.git'
const invalidRepositories = PUBLISHABLE.flatMap((dir) => {
  const repository = readPkg(dir).repository
  const url = typeof repository === 'string' ? repository : repository?.url
  return url === EXPECTED_REPOSITORY_URL ? [] : [`packages/${dir}: ${url ?? '<missing>'}`]
})
if (invalidRepositories.length > 0) {
  console.error(
    `✗ Publishable package repository metadata must be ${EXPECTED_REPOSITORY_URL}:\n` +
      invalidRepositories.map((entry) => `  - ${entry}`).join('\n'),
  )
  process.exit(1)
}

const irisDeps = (dir) =>
  Object.keys(readPkg(dir).dependencies || {})
    .filter((d) => d.startsWith('@iris-ui-kit/'))
    .map((d) => d.slice('@iris-ui-kit/'.length))

// `pnpm pack` bakes "workspace:*" down to a literal version (e.g. "0.0.0"), so
// react/vue/solid/svelte's un-published @iris-ui-kit/{icons,skins,theme,tokens}
// deps become real, unresolvable registry requests unless we pack + file:
// those too. BFS the whole @iris-ui-kit/* closure from PUBLISHABLE so `npm install`
// never has to reach the registry for anything workspace-internal.
const closure = new Set(PUBLISHABLE)
const queue = [...PUBLISHABLE]
while (queue.length) {
  const dir = queue.shift()
  for (const dep of irisDeps(dir)) {
    if (!closure.has(dep)) {
      closure.add(dep)
      queue.push(dep)
    }
  }
}
const ALL = [...closure]

for (const dir of ALL) {
  if (!existsSync(join(packagesDir, dir, 'dist'))) {
    console.error(`✗ packages/${dir}/dist not found — run \`pnpm build\` first.`)
    process.exit(1)
  }
}

console.log(
  `\nExternal pack + npm install smoke check (${PUBLISHABLE.length} publishable packages)\n` +
    '─'.repeat(72),
)

const collectExportPaths = (node, out = []) => {
  if (typeof node === 'string') {
    if (node.startsWith('./') && !node.includes('*')) out.push(node)
  } else if (node && typeof node === 'object') {
    for (const value of Object.values(node)) collectExportPaths(value, out)
  }
  return out
}

const runtimePaths = (node, condition) => {
  if (typeof node === 'string') {
    if (!/\.(?:c?js|mjs)$/.test(node)) return []
    if (condition === 'require' && !/\.cjs$/.test(node)) return []
    return [node]
  }
  if (!node || typeof node !== 'object') return []
  if (condition in node) return runtimePaths(node[condition], condition)
  if ('default' in node) return runtimePaths(node.default, condition)
  return []
}

/**
 * Expand an export wildcard against the files produced by the package build.
 * This turns contracts such as `./* -> ./dist/*.js` into concrete consumer
 * specifiers, so a stale wildcard can no longer hide behind structural checks.
 */
const expandWildcard = (dir, key, target) => {
  if (!key.includes('*') || !target.includes('*')) return []
  const root = join(packagesDir, dir)
  const files = []
  const visit = (directory) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name)
      if (statSync(path).isDirectory()) visit(path)
      else files.push(`./${relative(root, path).replaceAll('\\', '/')}`)
    }
  }
  visit(root)
  const escaped = target
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('(.+)')
  const pattern = new RegExp(`^${escaped}$`)
  return files.flatMap((path) => {
    const match = pattern.exec(path)
    return match?.[1] ? [key.replace('*', match[1])] : []
  })
}

const targetsForCondition = (dir, condition) => {
  if (dir === 'svelte') return []
  const pkg = readPkg(dir)
  const exportsMap = pkg.exports
  if (!exportsMap || typeof exportsMap !== 'object') return []
  const entries = Object.entries(exportsMap)
  const subpathMap = entries.some(([key]) => key.startsWith('.')) ? entries : [['.', exportsMap]]
  const keys = subpathMap.flatMap(([key, target]) => {
    if (key === './svelte' || key === './package.json') return []
    const paths = runtimePaths(target, condition)
    if (key.includes('*')) return paths.flatMap((path) => expandWildcard(dir, key, path))
    return paths.length > 0 ? [key] : []
  })
  return [...new Set(keys)].map((key) => ({
    dir,
    packageName: pkg.name,
    specifier: key === '.' ? pkg.name : `${pkg.name}/${key.slice(2)}`,
  }))
}

const IMPORT_TARGETS = PUBLISHABLE.flatMap((dir) => targetsForCondition(dir, 'import'))
const REQUIRE_TARGETS = PUBLISHABLE.flatMap((dir) => targetsForCondition(dir, 'require'))
const FORBIDDEN_ARTIFACT_DIRECTORY = /^(?:__tests__|__ssr__|fixtures?|test)$/i
const FORBIDDEN_ARTIFACT_FILE = /(?:\.test\.|(?:Harness|Probe|Demo|ThrowingChild)\.)/i

const findForbiddenArtifacts = (dir, root = dir, out = []) => {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (FORBIDDEN_ARTIFACT_DIRECTORY.test(name)) out.push(path.slice(root.length + 1))
      else findForbiddenArtifacts(path, root, out)
    } else if (FORBIDDEN_ARTIFACT_FILE.test(name)) {
      out.push(path.slice(root.length + 1))
    }
  }
  return out
}

async function run() {
  let scratchDir
  let failed = false
  try {
    scratchDir = mkdtempSync(join(tmpdir(), 'iris-ui-pack-install-'))
    const tarballDir = join(scratchDir, 'tarballs')
    mkdirSync(tarballDir)

    // 1. `pnpm pack` every package in the closure into a real npm tarball.
    const tarballs = {}
    for (const dir of ALL) {
      const res = spawnSync('pnpm', ['pack', '--json', '--pack-destination', tarballDir], {
        cwd: join(packagesDir, dir),
        encoding: 'utf8',
      })
      if (res.status !== 0) {
        failed = true
        console.error(`✗ pnpm pack failed for packages/${dir}\n${res.stderr}`)
        continue
      }
      tarballs[dir] = JSON.parse(res.stdout).filename
    }
    if (failed) return false

    // 2. A plain, non-workspace package.json — no "workspace:*", every
    //    @iris-ui-kit/* dep pinned to its packed tarball via file:.
    const dependencies = { ...CONSUMER_RUNTIME_DEPENDENCIES }
    for (const dir of ALL) dependencies[readPkg(dir).name] = `file:${tarballs[dir]}`
    writeFileSync(
      join(scratchDir, 'package.json'),
      JSON.stringify(
        {
          name: 'iris-ui-pack-install-smoke',
          version: '0.0.0',
          private: true,
          type: 'module',
          dependencies,
          devDependencies: CONSUMER_DEV_DEPENDENCIES,
        },
        null,
        2,
      ),
    )

    // 3. Plain `npm install` (not pnpm) — stronger proof resolution isn't
    //    accidentally leaning on pnpm's own hoisting/symlink behavior. When
    //    this script itself runs under `pnpm run`, pnpm injects its own
    //    npm_config_* env vars (e.g. a pnpm-only "allow-scripts" value) into
    //    this process — and child_process inherits env by default, so a naive
    //    spawn would hand npm config it can't parse. Strip those so `npm
    //    install` sees a clean, non-workspace environment either way.
    const npmEnv = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !/^npm_config_/i.test(k)),
    )
    const install = spawnSync(
      'npm',
      ['install', '--include=dev', '--prefer-offline', '--no-audit', '--no-fund', '--legacy-peer-deps'],
      {
        cwd: scratchDir,
        encoding: 'utf8',
        env: npmEnv,
      },
    )
    const installOk = install.status === 0
    if (!installOk) {
      failed = true
      console.error(`✗ npm install failed:\n${install.stderr}`)
    }

    // 4a. Raw-import every explicit precompiled JS export — package roots plus
    //     plugin /core, /react, /vue and /solid subpaths. This catches a broken
    //     subpath even when the package root (or another adapter) works.
    let importResults = IMPORT_TARGETS.map((target) => ({
      ...target,
      ok: false,
      error: 'not attempted (npm install failed)',
    }))
    if (installOk) {
      const smokeFile = join(scratchDir, 'smoke.mjs')
      writeFileSync(
        smokeFile,
        `const targets = ${JSON.stringify(IMPORT_TARGETS)}
const out = []
for (const target of targets) {
  try {
    const mod = await import(target.specifier)
    const ok = !!mod && typeof mod === 'object' && Object.keys(mod).length > 0
    out.push({ ...target, ok, error: ok ? null : 'module has no named exports' })
  } catch (err) {
    out.push({ ...target, ok: false, error: String((err && err.message) || err) })
  }
}
console.log(JSON.stringify(out))
process.exit(out.every((r) => r.ok) ? 0 : 1)
`,
      )
      const smoke = spawnSync('node', [smokeFile], { cwd: scratchDir, encoding: 'utf8' })
      try {
        importResults = JSON.parse(smoke.stdout.trim().split('\n').pop())
      } catch {
        failed = true
        const detail = smoke.stderr || smoke.stdout
        importResults = IMPORT_TARGETS.map((target) => ({
          ...target,
          ok: false,
          error: `smoke test crashed: ${detail}`,
        }))
      }
    }

    // 4b. Exercise every promised CommonJS entry through `require()`.
    let requireResults = REQUIRE_TARGETS.map((target) => ({
      ...target,
      ok: false,
      error: 'not attempted (npm install failed)',
    }))
    if (installOk) {
      const smokeFile = join(scratchDir, 'smoke.cjs')
      writeFileSync(
        smokeFile,
        `const targets = ${JSON.stringify(REQUIRE_TARGETS)}
const out = []
for (const target of targets) {
  try {
    const mod = require(target.specifier)
    const ok = !!mod && (typeof mod === 'object' || typeof mod === 'function') && Object.keys(mod).length > 0
    out.push({ ...target, ok, error: ok ? null : 'module has no exports' })
  } catch (err) {
    out.push({ ...target, ok: false, error: String((err && err.message) || err) })
  }
}
console.log(JSON.stringify(out))
process.exit(out.every((r) => r.ok) ? 0 : 1)
`,
      )
      const smoke = spawnSync('node', [smokeFile], { cwd: scratchDir, encoding: 'utf8' })
      try {
        requireResults = JSON.parse(smoke.stdout.trim().split('\n').pop())
      } catch {
        failed = true
        const detail = smoke.stderr || smoke.stdout
        requireResults = REQUIRE_TARGETS.map((target) => ({
          ...target,
          ok: false,
          error: `CommonJS smoke test crashed: ${detail}`,
        }))
      }
    }

    // 4c. Independently verify every explicit path promised by exports,
    //     main/module/svelte and bin survived the tarball. This is the primary
    //     proof for raw .svelte entries, which require a Svelte-aware compiler
    //     and therefore cannot be imported directly by plain Node.
    const resolveResults = PUBLISHABLE.map((dir) => {
      const name = readPkg(dir).name
      if (!installOk) {
        return { dir, packageName: name, ok: false, error: 'not attempted (npm install failed)' }
      }
      const installedDir = join(scratchDir, 'node_modules', name)
      try {
        const installedPkg = JSON.parse(readFileSync(join(installedDir, 'package.json'), 'utf8'))
        const paths = collectExportPaths(installedPkg.exports)
        for (const key of ['main', 'svelte', 'module']) {
          if (typeof installedPkg[key] === 'string' && installedPkg[key].startsWith('./')) {
            paths.push(installedPkg[key])
          }
        }
        const bins =
          typeof installedPkg.bin === 'string'
            ? [installedPkg.bin]
            : Object.values(installedPkg.bin ?? {})
        for (const bin of bins) {
          if (typeof bin === 'string' && bin.startsWith('./')) paths.push(bin)
        }
        const unique = [...new Set(paths)]
        const missing = unique.filter((p) => !existsSync(join(installedDir, p)))
        const forbidden = findForbiddenArtifacts(installedDir)
        const licensePath = join(installedDir, 'LICENSE')
        const licenseOk =
          existsSync(licensePath) && readFileSync(licensePath, 'utf8') === canonicalLicense
        return {
          dir,
          packageName: name,
          ok: unique.length > 0 && missing.length === 0 && forbidden.length === 0 && licenseOk,
          error:
            unique.length === 0
              ? 'package.json declares no resolvable exports/main/svelte paths'
              : missing.length
                ? `declared but missing on disk: ${missing.join(', ')}`
                : forbidden.length
                  ? `non-runtime artifact(s) shipped: ${forbidden.slice(0, 5).join(', ')}`
                  : !licenseOk
                    ? 'canonical MIT LICENSE is missing or stale'
                    : null,
        }
      } catch (err) {
        return {
          dir,
          packageName: name,
          ok: false,
          error: String((err && err.message) || err),
        }
      }
    })

    // 4d. Resolve the installed declaration surface with an external TypeScript
    // consumer. This catches declarations that exist on disk but reference a
    // missing file, dependency, or export.
    let typesResult = { ok: false, error: 'not attempted (npm install failed)' }
    if (installOk) {
      const typeTargets = [...new Set(IMPORT_TARGETS.map((target) => target.specifier))]
      writeFileSync(
        join(scratchDir, 'types-smoke.ts'),
        `${typeTargets.map((specifier, index) => `import type * as Module${index} from '${specifier}'`).join('\n')}
export type ResolvedModules = [${typeTargets.map((_, index) => `keyof typeof Module${index}`).join(', ')}]
`,
      )
      writeFileSync(
        join(scratchDir, 'tsconfig.json'),
        `${JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'NodeNext',
              moduleResolution: 'NodeNext',
              lib: ['ES2022', 'DOM', 'DOM.Iterable'],
              strict: true,
              noEmit: true,
              skipLibCheck: false,
            },
            include: ['types-smoke.ts'],
          },
          null,
          2,
        )}\n`,
      )
      const types = spawnSync(join(scratchDir, 'node_modules', '.bin', 'tsc'), ['-p', '.'], {
        cwd: scratchDir,
        encoding: 'utf8',
      })
      typesResult = {
        ok: types.status === 0,
        error: types.status === 0 ? null : types.stderr || types.stdout || `exit ${types.status}`,
      }
    }

    // 4e. Compile the installed raw Svelte adapter and every plugin `/svelte`
    // entry from outside the workspace.
    let svelteResult = { ok: false, error: 'not attempted (npm install failed)' }
    if (installOk) {
      const svelteTargets = [
        '@iris-ui-kit/svelte',
        ...PUBLISHABLE.map((dir) => readPkg(dir))
          .filter((pkg) => pkg.exports?.['./svelte'])
          .map((pkg) => `${pkg.name}/svelte`),
      ]
      const svelteRoot = join(scratchDir, 'svelte-consumer')
      mkdirSync(join(svelteRoot, 'src'), { recursive: true })
      writeFileSync(
        join(svelteRoot, 'src', 'App.svelte'),
        `<script lang="ts">
${svelteTargets.map((specifier, index) => `  import * as Module${index} from '${specifier}'`).join('\n')}
  import { IrisButton } from '@iris-ui-kit/svelte'
  const loadedModules = [${svelteTargets.map((_, index) => `Module${index}`).join(', ')}]
</script>

<p data-installed-svelte-modules={loadedModules.length}>External Svelte consumer</p>
<IrisButton asChild class="consumer-parent">
  {#snippet children(slotProps)}
    <a
      {...slotProps.merge({
        href: '/save',
        class: 'consumer-child',
        style: 'color: var(--iris-primary)',
      })}
    >
      Save
    </a>
  {/snippet}
</IrisButton>
`,
      )
      writeFileSync(join(svelteRoot, 'svelte.config.js'), 'export default {}\n')
      writeFileSync(
        join(svelteRoot, 'tsconfig.json'),
        `${JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'ESNext',
              moduleResolution: 'Bundler',
              strict: true,
              allowJs: true,
              checkJs: true,
              isolatedModules: true,
            },
            include: ['src/**/*.svelte'],
          },
          null,
          2,
        )}\n`,
      )
      const svelteCheck = spawnSync(
        join(scratchDir, 'node_modules', '.bin', 'svelte-check'),
        ['--workspace', svelteRoot, '--tsconfig', './tsconfig.json'],
        { cwd: scratchDir, encoding: 'utf8' },
      )
      svelteResult = {
        ok: svelteCheck.status === 0,
        error:
          svelteCheck.status === 0
            ? null
            : svelteCheck.stderr || svelteCheck.stdout || `exit ${svelteCheck.status}`,
      }
    }

    // 4f. The CLI should not merely exist: execute its installed npm bin as an
    //     external consumer would. The MCP bin is intentionally structural
    //     only because it is a long-running stdio server.
    let cliResult = { ok: false, error: 'not attempted (npm install failed)' }
    if (installOk) {
      const cli = spawnSync(join(scratchDir, 'node_modules', '.bin', 'iris-ui'), ['--help'], {
        cwd: scratchDir,
        encoding: 'utf8',
        timeout: 10_000,
      })
      cliResult = {
        ok: cli.status === 0 && /iris-ui/i.test(`${cli.stdout}\n${cli.stderr}`),
        error:
          cli.status === 0
            ? 'help output did not identify iris-ui'
            : cli.error?.message || cli.stderr || `exit ${cli.status}`,
      }
    }

    // 5. Report.
    for (const dir of PUBLISHABLE) {
      const name = readPkg(dir).name
      const structure = resolveResults.find((result) => result.dir === dir)
      const imports = importResults.filter((result) => result.dir === dir)
      const requires = requireResults.filter((result) => result.dir === dir)
      const importsOk = imports.every((result) => result.ok)
      const requiresOk = requires.every((result) => result.ok)
      const cliOk = dir !== 'cli' || cliResult.ok
      const ok = installOk && !!structure?.ok && importsOk && requiresOk && cliOk
      if (!ok) failed = true
      const failures = [
        structure?.ok ? null : `exports: ${structure?.error ?? 'unknown failure'}`,
        ...imports
          .filter((result) => !result.ok)
          .map((result) => `${result.specifier}: ${result.error}`),
        ...requires
          .filter((result) => !result.ok)
          .map((result) => `require(${result.specifier}): ${result.error}`),
        dir === 'cli' && !cliResult.ok ? `bin: ${cliResult.error}` : null,
      ].filter(Boolean)
      const checks = [
        `${imports.length} import${imports.length === 1 ? '' : 's'}`,
        `${requires.length} require${requires.length === 1 ? '' : 's'}`,
        'exports+license+types+svelte',
        ...(dir === 'cli' ? ['bin'] : []),
      ].join('+')
      console.log(
        `${ok ? '✓' : '✗'} ${name.padEnd(36)} pack ${installOk ? 'ok' : 'FAILED'}  ` +
          (ok ? `${checks} ok` : failures.join(' | ')),
      )
    }
    console.log(
      `${typesResult.ok ? '✓' : '✗'} external TypeScript consumer` +
        (typesResult.ok ? '' : `: ${typesResult.error}`),
    )
    console.log(
      `${svelteResult.ok ? '✓' : '✗'} external Svelte consumer` +
        (svelteResult.ok ? '' : `: ${svelteResult.error}`),
    )
    if (!typesResult.ok || !svelteResult.ok) failed = true
    return !failed
  } finally {
    if (scratchDir) {
      try {
        rmSync(scratchDir, { recursive: true, force: true })
      } catch {
        // best-effort cleanup
      }
    }
  }
}

const ok = await run()
console.log('')
if (!ok) {
  console.error('✗ pack+install smoke check failed\n')
  process.exit(1)
}
console.log(
  `✓ all ${PUBLISHABLE.length} publishable packages pack + npm-install with MIT licenses, intact wildcard/explicit exports, ESM imports, CJS requires, external TypeScript/Svelte compilation, and runnable CLI\n`,
)

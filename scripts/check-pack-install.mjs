#!/usr/bin/env node
// External-consumer pack+install smoke check. Every demo app in this repo
// consumes these packages via the pnpm workspace protocol ("workspace:*"),
// which only ever resolves through pnpm's own path/symlink machinery — no
// package has ever actually been installed the way a real external npm
// consumer would (a plain tarball dependency, outside any workspace). This
// packs the curated set of packages with real external consumers, installs
// them via plain `npm install` into a scratch project OUTSIDE the pnpm
// workspace, then does a real `import` from each and checks it resolves to a
// non-empty module. Run after build:
//
//   pnpm turbo run build --filter=@iris-ui/core --filter=@iris-ui/react \
//     --filter=@iris-ui/vue --filter=@iris-ui/solid --filter=@iris-ui/svelte
//   pnpm check:pack-install
//
// Zero deps: node:fs/os/path/url + child_process (pnpm/npm/node CLIs).
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages')
// The packages with real external consumers — these get import-smoke-tested.
const CURATED = ['core', 'react', 'vue', 'solid', 'svelte']

const readPkg = (dir) => JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8'))
const irisDeps = (dir) =>
  Object.keys(readPkg(dir).dependencies || {})
    .filter((d) => d.startsWith('@iris-ui/'))
    .map((d) => d.slice('@iris-ui/'.length))

// `pnpm pack` bakes "workspace:*" down to a literal version (e.g. "0.0.0"), so
// react/vue/solid/svelte's un-published @iris-ui/{icons,skins,theme,tokens}
// deps become real, unresolvable registry requests unless we pack + file:
// those too. BFS the whole @iris-ui/* closure from CURATED so `npm install`
// never has to reach the registry for anything workspace-internal.
const closure = new Set(CURATED)
const queue = [...CURATED]
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
    // eslint-disable-next-line no-console
    console.error(`✗ packages/${dir}/dist not found — run \`pnpm build\` first.`)
    process.exit(1)
  }
}

// eslint-disable-next-line no-console
console.log(
  '\nExternal pack + npm install smoke check (core/react/vue/solid/svelte)\n' + '─'.repeat(72),
)

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
        // eslint-disable-next-line no-console
        console.error(`✗ pnpm pack failed for packages/${dir}\n${res.stderr}`)
        continue
      }
      tarballs[dir] = JSON.parse(res.stdout).filename
    }
    if (failed) return false

    // 2. A plain, non-workspace package.json — no "workspace:*", every
    //    @iris-ui/* dep pinned to its packed tarball via file:.
    const dependencies = {}
    for (const dir of ALL) dependencies[readPkg(dir).name] = `file:${tarballs[dir]}`
    writeFileSync(
      join(scratchDir, 'package.json'),
      JSON.stringify(
        { name: 'iris-ui-pack-install-smoke', version: '0.0.0', private: true, dependencies },
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
    const install = spawnSync('npm', ['install'], {
      cwd: scratchDir,
      encoding: 'utf8',
      env: npmEnv,
    })
    const installOk = install.status === 0
    if (!installOk) {
      failed = true
      // eslint-disable-next-line no-console
      console.error(`✗ npm install failed:\n${install.stderr}`)
    }

    // 4. Smoke-test entry: a real `import` of each curated package from the
    //    external node_modules, asserting a non-empty (≥1 named export)
    //    module — proof the exports map / dist output resolves for real.
    const targets = CURATED.map((dir) => readPkg(dir).name)
    let results = targets.map((name) => ({
      name,
      ok: false,
      error: 'not attempted (npm install failed)',
    }))
    if (installOk) {
      const smokeFile = join(scratchDir, 'smoke.mjs')
      writeFileSync(
        smokeFile,
        `const targets = ${JSON.stringify(targets)}
const out = []
for (const name of targets) {
  try {
    const mod = await import(name)
    const ok = !!mod && typeof mod === 'object' && Object.keys(mod).length > 0
    out.push({ name, ok, error: ok ? null : 'module has no named exports' })
  } catch (err) {
    out.push({ name, ok: false, error: String((err && err.message) || err) })
  }
}
console.log(JSON.stringify(out))
process.exit(out.every((r) => r.ok) ? 0 : 1)
`,
      )
      const smoke = spawnSync('node', [smokeFile], { cwd: scratchDir, encoding: 'utf8' })
      try {
        results = JSON.parse(smoke.stdout.trim().split('\n').pop())
      } catch {
        failed = true
        const detail = smoke.stderr || smoke.stdout
        results = targets.map((name) => ({
          name,
          ok: false,
          error: `smoke test crashed: ${detail}`,
        }))
      }
    }

    // 5. Report.
    for (const dir of CURATED) {
      const name = readPkg(dir).name
      const r = results.find((x) => x.name === name)
      const ok = installOk && !!r?.ok
      if (!ok) failed = true
      // eslint-disable-next-line no-console
      console.log(
        `${ok ? '✓' : '✗'} ${name.padEnd(16)} pack ok  ${installOk ? 'install ok' : 'install FAILED'}  ` +
          (r?.ok ? 'import ok' : `import FAILED: ${r?.error ?? 'unknown'}`),
      )
    }
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
// eslint-disable-next-line no-console
console.log('')
if (!ok) {
  // eslint-disable-next-line no-console
  console.error('✗ pack+install smoke check failed\n')
  process.exit(1)
}
// eslint-disable-next-line no-console
console.log(
  '✓ core/react/vue/solid/svelte pack, npm-install, and import cleanly outside the workspace\n',
)

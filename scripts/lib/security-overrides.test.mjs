import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { test } from 'node:test'

function installedRequire(packageFile, chain) {
  let require = createRequire(packageFile)
  for (const name of chain) require = createRequire(require.resolve(name))
  return require
}

const desktop = new URL('../../apps/desktop/package.json', import.meta.url)
const downloader = installedRequire(desktop, [
  'electron-builder',
  'app-builder-lib',
  '@electron/get',
])
const cacheable = installedRequire(desktop, [
  'electron-builder',
  'app-builder-lib',
  '@electron/get',
  'got',
  'cacheable-request',
])
const CachePolicy = cacheable('http-cache-semantics')

// Resolve actual consumers, not an arbitrary (possibly stale) virtual-store copy.
test('downloader cache max-stale never bypasses URL, method, host or authorization Vary matching', () => {
  const request = {
    method: 'GET',
    url: 'https://cache.test/alice',
    headers: { host: 'cache.test', authorization: 'synthetic-alice' },
  }
  const policy = new CachePolicy(request, {
    status: 200,
    headers: {
      date: new Date().toUTCString(),
      'cache-control': 'public, max-age=60',
      vary: 'authorization',
    },
  })
  const clock = Date.now()
  policy.now = () => clock + 120_000
  const stale = { ...request, headers: { ...request.headers, 'cache-control': 'max-stale=600' } }
  assert.equal(policy.storable(), true)
  assert.equal(policy.satisfiesWithoutRevalidation(stale), true)
  for (const other of [
    { ...stale, url: 'https://cache.test/bob' },
    { ...stale, method: 'POST' },
    { ...stale, headers: { ...stale.headers, host: 'different.test' } },
    { ...stale, headers: { ...stale.headers, authorization: 'synthetic-bob' } },
  ])
    assert.equal(policy.satisfiesWithoutRevalidation(other), false)
})

test('Changesets retains ManyPkg v1 root shape, synchronous discovery and BOM YAML reads', async () => {
  const require = installedRequire(new URL('../../package.json', import.meta.url), [
    '@changesets/cli',
  ])
  const { getPackages, getPackagesSync } = require('@manypkg/get-packages')
  const dir = mkdtempSync(join(tmpdir(), 'iris-security-workspaces-'))
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'root', private: true }))
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), '\uFEFFpackages:\n  - "packages/*"\n')
    for (const name of ['one', 'two']) {
      mkdirSync(join(dir, 'packages', name), { recursive: true })
      writeFileSync(
        join(dir, 'packages', name, 'package.json'),
        JSON.stringify({ name, version: '1.0.0' }),
      )
    }
    const asyncResult = await getPackages(dir)
    const syncResult = getPackagesSync(dir)
    assert.equal(asyncResult.root.dir, dir)
    assert.equal(asyncResult.tool, 'pnpm')
    assert.deepEqual(asyncResult, syncResult)
    assert.deepEqual(asyncResult.packages.map((p) => p.packageJson.name).sort(), ['one', 'two'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('Electron downloader proxy bootstrap still routes and honors runtime NO_PROXY', () => {
  // Isolate global HTTP monkey-patching from the test runner; all endpoints are loopback.
  const script = `
    const http = require('node:http');
    const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const read = url => new Promise((resolve, reject) => http.get(url, r => {
      let body = ''; r.on('data', chunk => body += chunk); r.on('end', () => resolve(body));
    }).on('error', reject));
    const target = http.createServer((req, res) => res.end('target'));
    const proxy = http.createServer((req, res) => res.end('proxy'));
    (async () => {
      try {
        await listen(target); await listen(proxy);
        process.env.GLOBAL_AGENT_HTTP_PROXY = 'http://127.0.0.1:' + proxy.address().port;
        delete process.env.GLOBAL_AGENT_NO_PROXY;
        delete process.env.GLOBAL_AGENT_HTTPS_PROXY;
        require(process.argv[1]).bootstrap();
        const url = 'http://127.0.0.1:' + target.address().port;
        const proxied = await read(url);
        global.GLOBAL_AGENT.NO_PROXY = '127.0.0.1';
        const direct = await read(url);
        console.log(JSON.stringify({ proxied, direct }));
      } finally { target.close(); proxy.close(); }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `
  const result = spawnSync(process.execPath, ['-e', script, downloader.resolve('global-agent')], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 64 * 1024,
  })
  assert.equal(result.status, 0, result.stderr || String(result.error))
  assert.deepEqual(JSON.parse(result.stdout), { proxied: 'proxy', direct: 'target' })
})

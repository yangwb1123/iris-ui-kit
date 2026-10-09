import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { get } from 'node:https'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const nuxtApp = createRequire(new URL('../../apps/ssr-nuxt/package.json', import.meta.url))
const nuxt = createRequire(nuxtApp.resolve('nuxt/package.json'))
const cli = createRequire(nuxt.resolve('@nuxt/cli'))
const vinxi = createRequire(
  realpathSync(
    new URL('../../apps/ssr-solidstart/node_modules/vinxi/package.json', import.meta.url),
  ),
)
const consumers = [
  ['Nuxt', cli, 'listhen'],
  ['Vinxi', vinxi, '@vinxi/listhen'],
]

function request(port, ca, rejectUnauthorized = true) {
  return new Promise((resolve, reject) => {
    const req = get(
      { hostname: '127.0.0.1', port, ca, rejectUnauthorized, timeout: 2000 },
      (response) => {
        let body = ''
        response.on('data', (chunk) => {
          body += chunk
          if (body.length > 4096) req.destroy(new Error('Response budget exceeded'))
        })
        response.on('end', () => resolve(body))
        response.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new Error('TLS request timeout')))
    req.on('error', reject)
  })
}

for (const [name, parent, packageName] of consumers) {
  const entry = parent.resolve(packageName)
  const packageDir = dirname(dirname(entry))
  test(`${name} listener source actually delegates to native certificates, no forge imports`, () => {
    const manifest = parent(join(packageDir, 'package.json'))
    assert.equal(manifest.dependencies['node-forge'], undefined)
    for (const path of [entry, join(dirname(entry), 'index.mjs')]) {
      assert.doesNotMatch(
        readFileSync(path, 'utf8'),
        /['"]node-forge['"]|forge\.pki|forge__default/,
      )
    }
  })

  for (const mode of ['CJS', 'ESM']) {
    test(
      `${name} ${mode} actual listener: generated TLS, PEM files, PFX and rejection`,
      { timeout: 15000 },
      async () => {
        const listener =
          mode === 'CJS'
            ? parent(packageName)
            : await import(pathToFileURL(join(dirname(entry), 'index.mjs')).href)
        const dir = mkdtempSync(join(tmpdir(), 'iris-listener-tls-'))
        const owned = []
        const options = {
          hostname: '127.0.0.1',
          port: 0,
          public: false,
          isTest: true,
          autoClose: false,
          showURL: false,
        }
        const start = async (https) => {
          const server = await listener.listen((_req, res) => res.end('owned TLS fixture'), {
            ...options,
            https,
          })
          owned.push(server)
          return server
        }
        try {
          const cert = join(dir, 'cert.pem'),
            key = join(dir, 'key.pem'),
            pfx = join(dir, 'cert.p12')
          execFileSync(
            'openssl',
            [
              'req',
              '-x509',
              '-newkey',
              'rsa:2048',
              '-nodes',
              '-sha256',
              '-days',
              '1',
              '-subj',
              '/CN=localhost',
              '-addext',
              'subjectAltName=DNS:localhost,IP:127.0.0.1',
              '-keyout',
              key,
              '-out',
              cert,
            ],
            { timeout: 5000, stdio: 'ignore' },
          )
          execFileSync(
            'openssl',
            [
              'pkcs12',
              '-export',
              '-inkey',
              key,
              '-in',
              cert,
              '-out',
              pfx,
              '-passout',
              'pass:synthetic-pfx',
            ],
            { timeout: 5000, stdio: 'ignore' },
          )
          const generated = await start({ domains: ['localhost', '127.0.0.1', '::1'] })
          assert.equal(
            await request(generated.server.address().port, undefined, false),
            'owned TLS fixture',
          )
          await assert.rejects(
            request(generated.server.address().port),
            /certificate|issuer|self.signed/i,
          )
          const pem = await start({ key, cert })
          assert.equal(
            await request(pem.server.address().port, readFileSync(cert)),
            'owned TLS fixture',
          )
          const inline = await start({
            key: readFileSync(key, 'utf8'),
            cert: readFileSync(cert, 'utf8'),
          })
          assert.equal(
            await request(inline.server.address().port, readFileSync(cert)),
            'owned TLS fixture',
          )
          const bundled = await start({ pfx, passphrase: 'synthetic-pfx' })
          assert.equal(
            await request(bundled.server.address().port, readFileSync(cert)),
            'owned TLS fixture',
          )
          await assert.rejects(start({ pfx, passphrase: 'wrong' }))
          writeFileSync(pfx, 'malformed ASN.1')
          await assert.rejects(start({ pfx }))
        } finally {
          await Promise.all(owned.map((server) => server.close()))
          rmSync(dir, { recursive: true, force: true })
        }
      },
    )
  }
}

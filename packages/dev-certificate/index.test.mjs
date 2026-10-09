import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  X509Certificate,
  createPrivateKey,
  createHash,
  generateKeyPairSync,
  privateEncrypt,
  verify,
  constants,
} from 'node:crypto'
import { Buffer } from 'node:buffer'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateCACert, generateTLSCert, resolvePfx } from './index.mjs'

test('native CA/leaf signing retains encrypted keys, SHA256, SANs, issuer and key ownership', async () => {
  const ca = await generateCACert({
    commonName: 'fixture CA',
    passphrase: 'synthetic-ca-pass',
    validityDays: 2,
  })
  const leaf = await generateTLSCert({
    commonName: 'localhost',
    organization: 'Example, Inc',
    organizationalUnit: 'Unit+Test',
    signingKey: ca.key,
    signingKeyCert: ca.cert,
    signingKeyPassphrase: ca.passphrase,
    domains: ['localhost', '127.0.0.1', '::1'],
    passphrase: 'synthetic-leaf-pass',
    validityDays: 1,
  })
  const root = new X509Certificate(ca.cert)
  const cert = new X509Certificate(leaf.cert)
  assert.equal(root.ca, true)
  assert.equal(cert.ca, false)
  assert.equal(cert.verify(root.publicKey), true)
  assert.equal(cert.issuer, root.subject)
  assert.equal(cert.checkHost('localhost'), 'localhost')
  assert.equal(cert.checkIP('127.0.0.1'), '127.0.0.1')
  assert.equal(cert.checkIP('::1'), '::1')
  assert.equal(cert.toLegacyObject().subject.O, 'Example, Inc')
  assert.equal(cert.toLegacyObject().subject.OU, 'Unit+Test')
  assert.equal(
    cert.checkPrivateKey(createPrivateKey({ key: leaf.key, passphrase: leaf.passphrase })),
    true,
  )
  assert.throws(() => createPrivateKey({ key: leaf.key, passphrase: 'wrong' }))
  await assert.rejects(
    generateTLSCert({
      signingKey: ca.key,
      signingKeyCert: ca.cert,
      signingKeyPassphrase: 'wrong',
      domains: ['localhost'],
    }),
  )
})

test('native RSA rejects extra nested DigestInfo elements that retired forge accepted', () => {
  // Synthetic low-exponent key; never a generated development certificate.
  const keys = generateKeyPairSync('rsa', { modulusLength: 1024, publicExponent: 3 })
  const message = Buffer.from('synthetic DigestInfo shape fixture')
  const digest = createHash('sha256').update(message).digest()
  const oid = Buffer.from('0609608648016503040201', 'hex')
  const nullable = Buffer.from('0500', 'hex')
  const seq = (bytes) => Buffer.concat([Buffer.from([0x30, bytes.length]), bytes])
  for (const extra of [Buffer.alloc(0), nullable, oid]) {
    const digestInfo = seq(
      Buffer.concat([
        seq(Buffer.concat([oid, nullable, extra])),
        Buffer.from([4, digest.length]),
        digest,
      ]),
    )
    const block = Buffer.concat([
      Buffer.from([0, 1]),
      Buffer.alloc(128 - digestInfo.length - 3, 255),
      Buffer.from([0]),
      digestInfo,
    ])
    const signature = privateEncrypt(
      { key: keys.privateKey, padding: constants.RSA_NO_PADDING },
      block,
    )
    assert.equal(verify('sha256', message, keys.publicKey, signature), extra.length === 0)
  }
})

test('invalid certificate budgets and PFX inputs fail closed', async () => {
  for (const days of [-1, 0, NaN, Infinity]) {
    await assert.rejects(
      generateCACert({ commonName: 'invalid', validityDays: days }),
      /Invalid certificate validity/,
    )
  }
  const dir = await mkdtemp(join(tmpdir(), 'iris-native-pfx-'))
  try {
    const pfx = join(dir, 'bad.p12')
    await writeFile(pfx, 'not ASN.1')
    await assert.rejects(resolvePfx({ pfx, passphrase: 'synthetic' }))
    await writeFile(pfx, new Uint8Array(2 * 1024 * 1024 + 1))
    await assert.rejects(resolvePfx({ pfx }), /PFX input budget exceeded/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

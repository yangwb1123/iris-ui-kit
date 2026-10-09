// Internal tooling only: certificate signatures and PFX parsing use Node/OpenSSL,
// never the retired forge RSA/ASN.1 implementation. Not a browser/core dependency.
import { Buffer } from 'node:buffer'
import { createPrivateKey, X509Certificate } from 'node:crypto'
import { constants } from 'node:fs'
import { open } from 'node:fs/promises'
import { isIP } from 'node:net'
import { createSecureContext } from 'node:tls'
import selfsigned from 'selfsigned'

const SUBJECT_NAMES = {
  commonName: 'CN',
  countryCode: 'C',
  state: 'ST',
  locality: 'L',
  organization: 'O',
  organizationalUnit: 'OU',
  emailAddress: 'E',
}

function attributes(options) {
  return Object.entries(SUBJECT_NAMES)
    .filter(([name]) => options[name])
    .map(([name, shortName]) => ({
      shortName,
      // selfsigned assembles a DN string; escape RDN delimiters, not just TLS names.
      value: String(options[name])
        .replace(/[\\,+=<>;"\n\r]/g, (char) => `\\${char}`)
        .replace(/^([ #])| $/g, (char) => `\\${char}`),
    }))
}

function validity(days = 1) {
  const notBeforeDate = new Date()
  const notAfterDate = new Date(notBeforeDate)
  if (!Number.isFinite(days) || days <= 0) throw new RangeError('Invalid certificate validity')
  notAfterDate.setDate(notAfterDate.getDate() + days)
  if (!Number.isFinite(notAfterDate.getTime())) throw new RangeError('Invalid certificate validity')
  return { notBeforeDate, notAfterDate }
}

function validPassphrase(value) {
  return typeof value === 'string' && value.length < 2000
}

async function generate(options, extensions, ca) {
  const result = await selfsigned.generate(attributes(options), {
    keyType: 'rsa',
    keySize: options.bits || 2048,
    algorithm: 'sha256',
    ...validity(options.validityDays ?? 1),
    extensions,
    ca,
    ...(validPassphrase(options.passphrase) ? { passphrase: options.passphrase } : {}),
  })
  // A native parse/key check also guards against a mismatched generator result.
  const key = createPrivateKey({ key: result.private, passphrase: options.passphrase })
  const cert = new X509Certificate(result.cert)
  if (!cert.checkPrivateKey(key)) throw new Error('Certificate/private key mismatch')
  return {
    key: result.private,
    cert: result.cert,
    ...(validPassphrase(options.passphrase) ? { passphrase: options.passphrase } : {}),
  }
}

export async function generateCACert(options = {}) {
  return generate(options, [
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, critical: true },
  ])
}

export async function generateTLSCert(options) {
  const domains = options.domains?.length ? options.domains : ['localhost.local']
  const caKey = createPrivateKey({
    key: options.signingKey,
    passphrase: options.signingKeyPassphrase,
  })
  const caCert = new X509Certificate(options.signingKeyCert)
  if (!caCert.ca || !caCert.checkPrivateKey(caKey)) throw new Error('Invalid signing CA')
  return generate(
    { ...options, commonName: options.commonName || domains[0] },
    [
      { name: 'basicConstraints', cA: false, critical: true },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
      { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
      {
        name: 'subjectAltName',
        altNames: domains.map((domain) => {
          return isIP(domain) ? { type: 7, ip: domain } : { type: 2, value: domain }
        }),
      },
    ],
    {
      key: caKey.export({ type: 'pkcs8', format: 'pem' }),
      cert: options.signingKeyCert,
    },
  )
}

export async function resolvePfx(options) {
  const file = await open(options.pfx, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0))
  let pfx
  try {
    const stat = await file.stat()
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024)
      throw new RangeError('PFX input budget exceeded')
    pfx = Buffer.alloc(stat.size)
    let offset = 0
    while (offset < pfx.length) {
      const { bytesRead } = await file.read(pfx, offset, pfx.length - offset, offset)
      if (!bytesRead) throw new Error('PFX input changed during read')
      offset += bytesRead
    }
    if ((await file.stat()).size !== stat.size) throw new Error('PFX input changed during read')
  } finally {
    await file.close()
  }
  const result = { pfx, ...(options.passphrase ? { passphrase: options.passphrase } : {}) }
  createSecureContext(result) // native PKCS#12/MAC/password validation, fail before listen
  return result
}

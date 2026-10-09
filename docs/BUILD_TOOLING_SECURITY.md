# Node 20 build-tooling security compatibility

The supported Node range remains `^20.9.0 || >=22.0.0`. The release candidate
uses a frozen pnpm graph, not an engine override or edits to installed packages.
These changes affect internal discovery/development tooling, not browser APIs.

## Pattern matching

`@changesets/config@3.1.4` has a declarative patch routing its CJS and ESM
consumers through picomatch 4.0.7 with a 4096-character / 64-level input budget.
Its direct micromatch dependency is removed. Ordinary fixed/linked/ignore,
negation, duplicate and missing-package behavior is checked at the installed
consumer, not inferred from whether another hoisted dependency can resolve.

Other micromatch consumers use the explicit npm alias
`@dieub/braces-depth-guard@3.0.3-pn.3`. This is a maintained fork, **not an
upstream patched braces release**. Its registry signatures and provenance
attestation were independently verified in a small fixture; that verification
is not whole-dependency-graph attestation. Tests follow actual Changesets /
ManyPkg / globby / fast-glob / micromatch resolution and exercise normal grammar
and hostile strings/ASTs through parse, compile, expand and stringify. Infinity
options do not bypass the hard depth/length limits. These tests do not establish
unlimited AST width or expansion-cardinality safety. Retain/update the explicit
fork pin only with provenance, code, compatibility and hostile-input review.

## TLS listeners

Declarative patches for `listhen@1.10.1` and `@vinxi/listhen@1.5.6` remove
node-forge from the actual CJS/ESM/CLI listener paths. The private, unpublished
`@iris-ui-kit/dev-certificate` shares one ESM implementation with a CJS promise
shim. selfsigned 5.5.0/WebCrypto generates certificates; Node crypto validates
private-key ownership, CA/issuer signatures and certificate shape. Native Node
TLS validates PKCS#12/MAC/password before listen; no retired Forge RSA/ASN.1
implementation processes these listener inputs. Peculiar schema decorators and
X509 classes use the same 2.10.0 schema storage to avoid runtime incompatibility.

Actual listener regressions cover generated TLS, PEM file/inline, encrypted
keys, trusted/untrusted clients, PFX correct/wrong passwords and malformed ASN.1.
PFX files must be regular and at most 2 MiB; reads are bounded/nonblocking,
closed in finally, and size changes reject. This is not proof against arbitrary
concurrent same-size mutation. Tests own and close their sockets/files.

A native DigestInfo regression checks valid SHA-256 signatures and rejection of
extra nested NULL/OID fields. The preserved Forge baseline accepted those extra
fields in an **owned synthetic private-key shape witness**; it is not an external
forgery or production-acceptance claim. Native rejection, actual TLS behavior,
audit results, provenance and source inspection are separate evidence.

The public listener certificate/PEM/PFX option shapes remain supported. Retired
`_private` Forge-object factories are deliberately removed, not promised as
compatible private APIs. The helper must never be published or enter browser,
core or public-package production dependency graphs. A zero-advisory audit is
not release approval: whole-graph gates, size governance, registry consumers,
applicable native acceptance and independent review remain required.

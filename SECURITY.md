# Security policy

## Supported versions

Iris UI is currently in its pre-1.0 release line. Security fixes are applied to
the latest published version of each `@iris-ui-kit/*` package and to `main`.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

Use the repository's **Security → Report a vulnerability** flow to create a
private security advisory. Include:

- the affected package and version or commit;
- a minimal reproduction or proof of concept;
- the impact and required attacker capabilities;
- any suggested remediation, if known.

The maintainers will acknowledge a complete report within five business days,
coordinate validation and remediation privately, and publish an advisory after
a fix is available. Please avoid accessing data that is not yours and give the
maintainers a reasonable opportunity to release a fix before disclosure.

## Security expectations

- Treat Markdown, SVG, skin, locale, remote-app, and schema inputs as untrusted
  unless the consuming application explicitly establishes a trust boundary.
- Never commit registry, source-control, cloud, or LLM credentials. Use the
  host platform's secret store or a local credential helper.
- Report compromised package or source-control credentials immediately so they
  can be revoked independently of a code release.

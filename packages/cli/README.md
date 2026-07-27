# @iris-ui-kit/cli

Command-line scaffolding tool for Iris UI.

```
iris-ui list [--group=<group>]
iris-ui scaffold <ComponentName> [--framework=react|vue|solid|svelte]
iris-ui init [--framework=react|vue|solid|svelte] [--force]
iris-ui registry add <name> <catalog-url-or-path>
iris-ui add <item...> [--registry=<name>] [--force] [--dry-run]
iris-ui diff <item...> [--registry=<name>]
iris-ui update [item...] [--registry=<name>]
iris-ui codemod list
iris-ui codemod run <name> <glob-or-path> [--dry-run]
```

- `list` — print all components from the generated manifest (optionally filtered by group).
- `scaffold` — print a ready-to-paste import + usage snippet for a component.
- `init` — create the framework-aware `iris.json` config and `iris.lock.json`.
- `registry add` — register an HTTPS catalog or local catalog path.
- `add` — install integrity-verified, framework-specific source and merge package dependencies.
- `diff` — preview registry changes without writing consumer files.
- `update` — refresh named or all locked items while refusing unmanaged/local modifications.
- `codemod` — list or run a registered source-text migration for a breaking public-API change.

Remote catalog items and their source files must carry SHA-256 integrity values.
Installed file hashes and source locations are recorded in `iris.lock.json`, so
updates cannot silently overwrite local edits or traverse symlinks.

## Codemods

`docs/AUTONOMOUS.md` treats "change a public interface" as a hard stop requiring human
sign-off — but stopping-and-asking doesn't help a downstream consumer actually update their
code once a breaking change is approved and ships. That's what `codemod` is for.

**Convention going forward:** a PR that ships a breaking public-API change (a renamed prop, a
reshaped value, a removed member) should add a codemod alongside it under
`packages/cli/src/codemods/`, registered in `packages/cli/src/codemods/registry.ts`. Write the
old→new note in the commit body as usual; consumers run `iris-ui codemod run <name> <path>
--dry-run` to preview the rewrite, then without `--dry-run` to apply it.

Codemods here are deliberately **not** AST-based — no `jscodeshift`/`ts-morph`/etc. dependency.
This project's actual breaking changes have been simple, mechanical shape/name changes (e.g. a
prop rename, an object-literal key rename), so a well-scoped regex-based source-text `transform`
is a legitimate, honest match for the problem, not a corner-cut. Each codemod is a
`{ name, description, transform(source, filePath) }` object (see
`packages/cli/src/codemods/types.ts`); `run` only writes a file back if `transform` actually
changed its contents, and file matching is a plain recursive directory walk with an optional
trailing `*.ext` filter — not a general glob implementation.

The one shipped example, `toast-error-to-danger`, rewrites the `tone`/`variant` object-literal
value `'error'` to `'danger'`, matching the `NotificationTone`/`IrisToastVariant` unification in
commit `163f9e2`. It is registered but was **not** run against this repo's own source as part of
adding it — it exists purely as a working template for the next breaking change.

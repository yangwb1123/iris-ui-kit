# Iris source registry

Application shells, pages, blocks, and components are installed as source during
development. They are then imported normally by the consumer application; Iris
does not download executable templates at runtime.

```sh
iris-ui init --framework=react
iris-ui registry add local ./registry/registry.json
iris-ui add admin-layout --registry=local
```

`admin-layout` keeps one stable shell while allowing sidebar/horizontal
navigation, menu alignment, content width/height, sticky header/tabs,
breadcrumb/tabs visibility, collapse state, and density to be persisted.
Runtime pages still render live application data through the shell slot/render
prop.

## SHA-256 integrity

Catalog item documents and fetched source files use
`sha256-<64 hex characters>` integrity values. The CLI requires both levels for
an HTTP(S) catalog, verifies the fetched bytes before parsing or writing, and
rejects a missing or mismatched digest. Local catalogs may omit integrity, but a
declared value is always checked.

`iris.lock.json` records the resolved item source and the SHA-256 of every
installed target. `iris-ui diff` is read-only; `iris-ui update` refuses to
replace locally modified or unmanaged files unless `--force` is explicit. Path
validation and symlink checks keep registry writes inside the configured project
aliases.

## Declarative marketplace

`marketplace/manifest.json` is a separate runtime catalog for non-executable
`iris:skin`, `iris:font`, `iris:blueprint`, and `iris:view` payloads. Every
official entry carries a SHA-256 digest, verified before JSON parsing or
installation. Font resources may additionally pin each font source. Runtime
installers return teardown functions so a failed replacement can restore the
previous resource instead of persisting a partial install.

Executable templates, pages, blocks, and components remain source-installed and
are rejected by the runtime marketplace parser.

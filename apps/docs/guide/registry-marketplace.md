# Registry, templates, and the runtime marketplace

Iris uses two installation paths because application source and declarative
appearance data have different safety and lifecycle requirements.

```
development/build time                         runtime
────────────────────────                       ─────────────────────────────
Iris Registry                                  Iris Marketplace
template · page · block · component            skin · font · blueprint · view
        │                                               │
        ▼                                               ▼
source files copied into the application       validated JSON/data installation
        │                                               │
        ▼                                               ▼
normal static imports + bundler                fixed local widget map + live data
```

## Source-installed application shells

Templates follow the shadcn-style source ownership model. The CLI chooses one
framework variant, copies it into the application, records hashes in
`iris.lock.json`, and leaves the result editable.

```sh
iris-ui init --framework=react
iris-ui registry add local ./registry/registry.json
iris-ui add admin-layout --registry=local
iris-ui diff admin-layout --registry=local
iris-ui update admin-layout --registry=local
```

The installed `admin-layout` template is based on the capabilities of the
neighboring sverpweb project:

- sidebar or horizontal navigation;
- start/center/end horizontal menu alignment;
- fluid or centered content;
- viewport or document-height content;
- persistent collapse, tabs, breadcrumb, sticky header/tabs, and density;
- multi-page tabs with refresh, close-left/right/others/all, and pointer/touch
  reorder.

The shell is not replaced at runtime. Pages and route components remain normal
static imports. The shell's slot/render prop displays their current data, so
users still move between different functional pages without a visual
architecture swap.

## Integrity and update safety

Registry integrity values use the exact `sha256-<64 hex characters>` form.
Remote catalogs must declare a digest for every referenced item document, and
remote item documents must declare one for every fetched source file. The CLI
checks the fetched bytes before parsing or writing them; a missing or mismatched
digest stops the install. Local registries may omit digests, but any digest they
do provide is still validated.

After installation, `iris.lock.json` records each installed file's SHA-256 and
its resolved source location. `diff` stays read-only, while `update` refuses to
overwrite a locally modified or unmanaged target unless the user explicitly
passes `--force`. Safe-relative-path checks and symlink-boundary checks prevent
a registry item from escaping the configured project aliases.

## Runtime resource store

`@iris-ui-kit/marketplace` accepts only four declarative resource types:

| Type             | Runtime effect                                                 |
| ---------------- | -------------------------------------------------------------- |
| `iris:skin`      | validates and registers token data in the skin engine          |
| `iris:font`      | loads `FontFace` assets, caches bytes, and sets the font token |
| `iris:blueprint` | validates a page node tree against an application widget map   |
| `iris:view`      | installs table/filter/sort/column/density preferences as data  |

Executable `iris:template`, `iris:page`, `iris:block`, and `iris:component`
payloads are rejected by the runtime parser.

```ts
import {
  createRuntimeMarketplace,
  createSkinResourceInstaller,
  createFontResourceInstaller,
  localStorageMarketplaceStorage,
} from '@iris-ui-kit/marketplace'

const marketplace = createRuntimeMarketplace({
  manifestUrl: '/marketplace/manifest.json',
  storage: localStorageMarketplaceStorage(),
  installers: {
    'iris:skin': createSkinResourceInstaller(skinEngine),
    'iris:font': createFontResourceInstaller(),
  },
})

await marketplace.loadCatalog()
await marketplace.install('ocean')
```

Marketplace manifests use the same `sha256-<64 hex characters>` format. When an
entry declares `integrity`, the downloaded resource text is hashed before JSON
parsing or installer execution. Font sources can declare their own SHA-256;
bytes are verified before they are cached or passed to `FontFace`. The official
catalog declares integrity for every shipped resource, and HTTPS catalogs
cannot downgrade resource URLs to HTTP.

Runtime installation is also reversible. Each installer returns a teardown
function. Replacing a resource first tears down the old version; if the new
installer fails, the marketplace attempts to restore the previous installed
payload. A failed install is therefore not persisted as the active resource.

## Blueprint rendering remains locally typed

A blueprint names widgets, but cannot register or download components. The host
supplies the only allowed map from its static imports:

```ts
import { compilePageBlueprint } from '@iris-ui-kit/marketplace'
import { RevenueStat } from './widgets/RevenueStat'
import { OrdersTable } from './widgets/OrdersTable'

const widgets = {
  stat: RevenueStat,
  table: OrdersTable,
}

const nodes = compilePageBlueprint(blueprint, widgets, liveData)
```

Event handler props, HTML injection props, unknown widgets, excessive nesting,
duplicate IDs, and non-JSON values are rejected. Rendering `nodes` is a small
framework-local switch/map so component typing and tree-shaking remain intact.

## Why this is compatible with shadcn/ui

Iris adopts the useful part of shadcn's model—source registries and application
ownership—without turning the cross-framework component set into four copied
code bases. Stable primitives, shared behavior, tokens, and adapters remain
packages; application-specific shells and blocks are source-installed. This
hybrid keeps core fixes and cross-framework parity centralized while allowing
product layouts to be freely edited.

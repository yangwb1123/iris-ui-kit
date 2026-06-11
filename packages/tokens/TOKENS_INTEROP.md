# Design token interop

Iris design tokens are authored once (`@iris-ui/tokens`) and exported in the
interoperable formats every design-tooling pipeline reads — so the same source
of truth drives runtime CSS, Style Dictionary builds, and Figma.

## 1. W3C DTCG export

`toDtcg(theme)` / `toDtcgJson(theme)` produce a [W3C Design Tokens Community
Group](https://www.designtokens.org/) document (`$type` / `$value`), the lowest
common denominator consumed by Style Dictionary, Tokens Studio, and Figma
Variables.

```ts
import { toDtcgJson, lightTheme } from '@iris-ui/tokens'
writeFileSync('iris-light.tokens.json', toDtcgJson(lightTheme))
```

## 2. Style Dictionary

For teams that want the full multi-platform pipeline (CSS, JS, JSON, Tailwind,
iOS, Android…), `irisStyleDictionaryConfig()` returns a ready-to-run Style
Dictionary v4 config that consumes the DTCG files above.

```bash
pnpm --filter @iris-ui/tokens tokens:build
#  → dist/tokens/iris-light.tokens.json
#  → dist/tokens/iris-dark.tokens.json
#  → dist/tokens/style-dictionary.config.json
cd packages/tokens/dist/tokens
npx style-dictionary build --config style-dictionary.config.json   # → build/iris.css, iris.js, iris.tokens.json
```

No Style Dictionary install? `dtcgToCss(toDtcg(theme))` emits the same
`css/variables` output dependency-free:

```ts
import { dtcgToCss, toDtcg, darkTheme } from '@iris-ui/tokens'
const css = dtcgToCss(toDtcg(darkTheme), { selector: '[data-iris-theme="dark"]' })
```

(`@iris-ui/theme`'s `themeToCss` is the runtime equivalent that works straight
from an `IrisTheme`; `dtcgToCss` is the DTCG-pipeline equivalent.)

## 3. Figma round-trip

- **Tokens (Figma Variables / Tokens Studio):** import the DTCG `*.tokens.json`
  from step 1 directly — Tokens Studio reads DTCG natively, and Figma Variables
  import the flat JSON. Edits made in Figma export back to DTCG, closing the
  round-trip.
- **Components (Code Connect):** `figma/*.figma.tsx` are [Figma Code
  Connect](https://www.figma.com/code-connect-docs/) templates mapping Figma
  component variants to Iris React code (`IrisButton`, `IrisSwitch`, …), with a
  ready `figma.config.json` (`include: figma/**/*.figma.tsx`, `parser: react`).
  Fill in each component's Figma node URL and publish:

  ```bash
  npm i -D @figma/code-connect
  cd packages/tokens && npx figma connect publish   # reads figma.config.json
  ```

  The templates live outside `src/` so they never enter the library build (Code
  Connect is a tooling-only dependency). Add a component by dropping in another
  `figma/<Name>.figma.tsx`.

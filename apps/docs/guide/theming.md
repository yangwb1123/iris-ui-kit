# Theming

Every visual value is a design token exposed as a CSS variable. A theme is a
plain object; swapping it reskins the whole system.

```ts
{ name: 'monokai-pro', type: 'dark',
  colors: { 'iris.background': '#2D2D2D', 'iris.primary': '#A6E22E', /* … */ },
  spacing: { 'iris.gap.md': 8 }, radii: { 'iris.radius.md': 4 } }
```

- JS key `iris.background` ↔ CSS variable `--iris-background` (`toCssVarName`).
- Components style only via `var(--iris-*)` — no hardcoded colors.

## Light / dark + system

```ts
import { useColorScheme } from '@iris-ui-kit/react' // or @iris-ui-kit/vue
// follow the OS preference:
const scheme = useColorScheme() // 'light' | 'dark', reactive
// then store.setTheme(scheme === 'dark' ? 'dark' : 'light')
```

## Reduced motion

`ThemeProvider` injects a `prefers-reduced-motion` rule that neutralizes
animations/transitions across the themed subtree — no per-component work needed.

## RTL

Pass `dir="rtl"` to `ThemeProvider`; it sets `dir` / `data-iris-dir` on the
root so CSS logical properties and native flow mirror. `useDirection()` exposes
the current direction reactively.

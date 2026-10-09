/**
 * Bounded admin-chrome geometry — the single source for the optional
 * `size?: 'sm' | 'md' | 'lg'` prop that every adapter's `IrisNavMenu` and
 * `IrisAdminTabs` accepts.
 *
 * Why this lives in core (C-class, shared pure decisions): an app that wanted a denser
 * shell used to ship ~280 lines of application CSS that overrode component
 * internals and re-declared the nested indent separately for depths 0..9.
 * Bounded geometry is a lookup table, not framework behaviour, so all four
 * adapters read the SAME numbers here and only *bridge* them: react/solid/
 * svelte inline them, vue's nav injects them as CSS custom properties into its
 * singleton stylesheet.
 *
 * Invariants every adapter must keep when rendering these numbers:
 *  - `box-sizing: border-box`, so `min-height`/`width`/`height` are the real
 *    rendered box; a larger font GROWS the row instead of clipping its label.
 *  - Logical properties only (`padding-inline-*`), so RTL keeps mirroring.
 *  - A shrinkable label (`flex: 0 1 auto` + `min-width: 0` + `overflow: hidden`
 *    + `text-overflow: ellipsis`), so width/label ellipsis survives every size.
 *  - `md` reproduces the geometry these components shipped before the prop
 *    existed, so `size` is strictly opt-in (an omitted `size` renders `md`).
 */

/** Bounded chrome size tiers (small / default / large). */
export type AdminChromeSize = 'sm' | 'md' | 'lg'

export const ADMIN_CHROME_SIZES: readonly AdminChromeSize[] = ['sm', 'md', 'lg']

/** The size an omitted / unknown `size` prop resolves to. */
export const DEFAULT_ADMIN_CHROME_SIZE: AdminChromeSize = 'md'

/**
 * Nav-row geometry for one tier. Every length is a px number; the font stays a
 * token-valued CSS string so a skin can retune type without losing the row.
 */
export interface AdminNavChrome {
  /** Row floor in px; `null` = content-driven (no floor at all). */
  itemMinHeight: number | null
  /** Icon ↔ label gap inside a row. */
  itemGap: number
  /** Row padding block / inline (RTL-safe logical pairs). */
  paddingBlock: number
  paddingInline: number
  /** `padding-inline-start` at depth 0; also the collapsed-rail padding. */
  indentBase: number
  /** Added to `indentBase` per nesting level — unbounded, never clamped. */
  indentStep: number
  /** Token-valued so skins/size tokens win over the fallback. */
  fontSize: string
  iconSize: number
  arrowSize: number
  /** Icon-only collapsed rail. */
  collapsedIconSize: number
  collapsedPadding: number
  /** Gap between sibling rows / nested groups. */
  menuGap: number
}

/** Tab-bar geometry for one tier (lengths in px; fonts token-valued). */
export interface AdminTabsChrome {
  /** Allow the bar/scroll region to shrink in grid/flex parents, not expand them. */
  barMinWidth: number
  scrollMinWidth: number
  /** Bar floor in px; `null` = content-driven (no floor at all). */
  barMinHeight: number | null
  /** Gap between the scrolling chip list and the trailing actions trigger. */
  barGap: number
  barPaddingBlock: number
  barPaddingInline: number
  /** Chip floor in px; `null` = content-driven. */
  chipMinHeight: number | null
  /** Label ↔ close-button gap inside a chip. */
  chipGap: number
  chipPaddingBlock: number
  /** Chips lean on a wider inline-start (the title side) at the default tier. */
  chipPaddingInlineStart: number
  chipPaddingInlineEnd: number
  labelGap: number
  labelFontSize: string
  tabIconSize: number
  closeSize: number
  closeIconSize: number
  actionsSize: number
  actionsIconSize: number
}

const px = (value: number): string => `${value}px`

/**
 * Per-tier tables, frozen so an adapter cannot mutate shared geometry.
 * `md` mirrors the pre-`size` defaults row-for-row.
 */
const NAV_CHROME: Readonly<Record<AdminChromeSize, Readonly<AdminNavChrome>>> = Object.freeze({
  sm: Object.freeze({
    itemMinHeight: 28,
    itemGap: 8,
    paddingBlock: 4,
    paddingInline: 8,
    indentBase: 8,
    indentStep: 12,
    fontSize: 'var(--iris-font-size-sm, 13px)',
    iconSize: 14,
    arrowSize: 12,
    collapsedIconSize: 16,
    collapsedPadding: 8,
    menuGap: 2,
  }),
  md: Object.freeze({
    itemMinHeight: 34,
    itemGap: 12,
    paddingBlock: 8,
    paddingInline: 12,
    indentBase: 12,
    indentStep: 16,
    fontSize: 'var(--iris-font-size-md, 14px)',
    iconSize: 18,
    arrowSize: 16,
    collapsedIconSize: 20,
    collapsedPadding: 12,
    menuGap: 4,
  }),
  lg: Object.freeze({
    itemMinHeight: 40,
    itemGap: 12,
    paddingBlock: 8,
    paddingInline: 12,
    indentBase: 12,
    indentStep: 16,
    fontSize: 'var(--iris-font-size-lg, 16px)',
    iconSize: 22,
    arrowSize: 18,
    collapsedIconSize: 24,
    collapsedPadding: 16,
    menuGap: 6,
  }),
})

const TABS_CHROME: Readonly<Record<AdminChromeSize, Readonly<AdminTabsChrome>>> = Object.freeze({
  sm: Object.freeze({
    barMinWidth: 0,
    scrollMinWidth: 0,
    barMinHeight: 32,
    barGap: 4,
    barPaddingBlock: 4,
    barPaddingInline: 8,
    chipMinHeight: 28,
    chipGap: 4,
    chipPaddingBlock: 4,
    chipPaddingInlineStart: 8,
    chipPaddingInlineEnd: 8,
    labelGap: 6,
    labelFontSize: 'var(--iris-font-size-sm, 13px)',
    tabIconSize: 12,
    closeSize: 14,
    closeIconSize: 10,
    actionsSize: 28,
    actionsIconSize: 14,
  }),
  md: Object.freeze({
    // The bar/chip heights stayed content-driven before `size` existed.
    barMinWidth: 0,
    scrollMinWidth: 0,
    barMinHeight: null,
    barGap: 8,
    barPaddingBlock: 6,
    barPaddingInline: 12,
    chipMinHeight: null,
    chipGap: 4,
    chipPaddingBlock: 6,
    chipPaddingInlineStart: 12,
    chipPaddingInlineEnd: 8,
    labelGap: 8,
    labelFontSize: 'var(--iris-font-size-sm, 13px)',
    tabIconSize: 14,
    closeSize: 16,
    closeIconSize: 12,
    actionsSize: 28,
    actionsIconSize: 16,
  }),
  lg: Object.freeze({
    barMinWidth: 0,
    scrollMinWidth: 0,
    barMinHeight: 48,
    barGap: 8,
    barPaddingBlock: 8,
    barPaddingInline: 16,
    chipMinHeight: 40,
    chipGap: 8,
    chipPaddingBlock: 8,
    chipPaddingInlineStart: 12,
    chipPaddingInlineEnd: 12,
    labelGap: 10,
    labelFontSize: 'var(--iris-font-size-lg, 16px)',
    tabIconSize: 16,
    closeSize: 16,
    closeIconSize: 14,
    actionsSize: 40,
    actionsIconSize: 18,
  }),
})

/** Normalize an optional prop value; anything unknown resolves to `md`. */
export function resolveAdminChromeSize(size?: AdminChromeSize | null): AdminChromeSize {
  return ADMIN_CHROME_SIZES.includes(size as AdminChromeSize)
    ? (size as AdminChromeSize)
    : DEFAULT_ADMIN_CHROME_SIZE
}

/** Nav-row geometry for `size` (default `md`). */
export function adminNavChrome(size?: AdminChromeSize | null): Readonly<AdminNavChrome> {
  return NAV_CHROME[resolveAdminChromeSize(size)]
}

/** Tab-bar geometry for `size` (default `md`). */
export function adminTabsChrome(size?: AdminChromeSize | null): Readonly<AdminTabsChrome> {
  return TABS_CHROME[resolveAdminChromeSize(size)]
}

/**
 * `padding-inline-start` for a nav row at `depth` — `indentBase + depth *
 * indentStep`, computed for ANY depth (0, 9, 10, 100 …) so arbitrarily deep
 * trees stay aligned without a per-depth ladder in CSS. Non-finite / negative
 * depths fall back to the top level.
 */
export function adminNavIndent(chrome: AdminNavChrome, depth: number): number {
  const level = Number.isFinite(depth) ? Math.max(0, Math.floor(depth)) : 0
  return chrome.indentBase + level * chrome.indentStep
}

/** px string for a chrome length (`null` min-heights mean "content-driven"). */
export function adminChromePx(length: number | null): string | undefined {
  return length === null ? undefined : px(length)
}

/**
 * The nav geometry as CSS custom properties — the bridge for adapters whose nav
 * chrome lives in a stylesheet (vue) instead of inline styles. The property
 * names match the nav stylesheet's own knobs, and the values are the same ones
 * react/solid/svelte inline, so one tier drives all four renderers.
 */
export function adminNavCssVars(size?: AdminChromeSize | null): Record<string, string> {
  const chrome = adminNavChrome(size)
  return {
    '--iris-nav-item-height': adminChromePx(chrome.itemMinHeight) ?? 'auto',
    '--iris-nav-item-gap': px(chrome.itemGap),
    '--iris-nav-item-padding-block': px(chrome.paddingBlock),
    '--iris-nav-item-padding-inline': px(chrome.paddingInline),
    '--iris-nav-item-padding-collapsed': px(chrome.collapsedPadding),
    '--iris-nav-indent-base': px(chrome.indentBase),
    '--iris-nav-indent-step': px(chrome.indentStep),
    '--iris-nav-item-font-size': chrome.fontSize,
    '--iris-nav-menu-gap': px(chrome.menuGap),
  }
}

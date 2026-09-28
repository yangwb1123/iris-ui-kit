# Read-only audit

`pnpm audit:tokens` currently passes; `iris.radius.full` is now canonical. The following defects are outside that check.

## P1

1. **Scoped themes and RTL do not follow default portals.**  
   Evidence: `packages/theme/src/applyTheme.ts:73-80`, `applyDirection.ts:34-35`, `packages/react/src/theme/ThemeProvider.tsx:51-52`; Dialog/Popover default to `document.body` (`packages/react/src/primitives/dialog/DialogContent.tsx:130`, `PopoverContent.tsx:120`, `packages/svelte/src/internal/portal.ts:11`).  
   **Fix:** propagate a provider portal root, or mirror theme variables/`dir` onto portal hosts.  
   **Gate:** custom `target` + default Dialog/Popover tests in all four adapters.

2. **Reduced-motion rules are unavailable outside `ThemeProvider` and miss scoped portals.**  
   Evidence: `packages/theme/src/globalStyles.ts:92-100`; stylesheet injection only occurs in `ThemeProvider` (`packages/react/src/theme/ThemeProvider.tsx:51`), while `IrisProvider.theme` is optional (`packages/react/src/provider/IrisProvider.tsx:16-17`).  
   **Fix:** install motion rules independently of theme application, or explicitly register portal roots.  
   **Gate:** standalone components and portals under mocked `prefers-reduced-motion`.

3. **Solid/Svelte sliders and range sliders use LTR pointer math under RTL.**  
   Evidence: `packages/solid/src/primitives/slider/IrisSlider.tsx:89-97`, `packages/svelte/src/primitives/slider/IrisSlider.svelte:85-93`, range equivalents at `packages/solid/src/primitives/range-slider/IrisRangeSlider.tsx:95-101` and `packages/svelte/src/primitives/range-slider/IrisRangeSlider.svelte:85-91`; React/Vue already use `getDirection`.  
   **Fix:** invert horizontal ratios when `dir="rtl"` using shared direction logic.  
   **Gate:** pointer tests at both track edges with RTL.

4. **Select chevrons and reserved padding use physical `right` values.**  
   Evidence: React `SelectTrigger.tsx:67`, Vue `Select.ts:317`, Solid `IrisSelect.tsx:400`, Svelte `IrisSelect.svelte:359`; size maps also use physical four-side padding.  
   **Fix:** use `inset-inline-end` and logical inline padding.  
   **Gate:** RTL snapshots verifying chevron placement and text clearance.

5. **Switch thumbs are physically left-anchored.**  
   Evidence: React `Switch.tsx:75-80`, Vue `Switch.ts:63-68`, Solid `Switch.tsx:113-118`, Svelte `Switch.svelte:72-77`.  
   **Fix:** use `inset-inline-start` and transition that property.  
   **Gate:** checked/unchecked RTL visual tests.

6. **Submenus are always positioned and keyboarded as LTR.**  
   Evidence: `placement: 'right-start'` in React `MenuSub.tsx:55`, Vue `MenuSub.ts:106`, Solid `IrisMenuSub.tsx:28`, Svelte `IrisMenuSub.svelte:52`; all use fixed ArrowRight/ArrowLeft logic.  
   **Fix:** derive placement, opening key, closing key, and chevron direction from `dir`.  
   **Gate:** RTL submenu placement and keyboard contract tests.

7. **Semantic overlays bypass the canonical backdrop token.**  
   Evidence: Command Palette uses raw `rgba` at React `CommandPalette.tsx:212`, Vue `CommandPalette.ts:173`, Solid `IrisCommandPalette.tsx:172`, Svelte `IrisCommandPalette.svelte:149`; Image/Tour/Drawer contain similar literals.  
   **Fix:** use `--iris-backdrop` or registered component-specific overlay tokens.  
   **Gate:** custom-theme overrides must change every overlay backdrop.

8. **Dark-theme foreground contrast is defeated by hardcoded white.**  
   Evidence: dark theme defines dark foregrounds at `packages/tokens/src/dark.ts:14,20`; Solid CopyButton uses `#fff` at `IrisCopyButton.tsx:98`, Vue SplitButton uses `#fff` at `SplitButton.ts:83`, and split-button dividers use white RGBA across adapters.  
   **Fix:** use `--iris-success-foreground` / `--iris-primary-foreground` and token-derived divider colors.  
   **Gate:** dark-theme contrast assertions plus raw semantic-color lint.

9. **Solid indeterminate Progress references a nonexistent animation.**  
   Evidence: `packages/solid/src/primitives/progress/IrisProgress.tsx:83` uses `iris-progress-slide`; the repository only defines `iris-progress-indeterminate` in React/Vue/Svelte progress sources.  
   **Fix:** reuse the shared progress stylesheet/keyframe.  
   **Gate:** assert every referenced keyframe is defined and test indeterminate rendering.

## P2

10. **Typography token name is wrong and hidden from the token audit.**  
    Canonical key: `packages/tokens/src/tokens.ts:51` → `--iris-font-letter-spacing-wide` via `packages/theme/src/toCssVarName.ts:9`. Adapters use nonexistent `--iris-letter-spacing-wide` (`packages/react/src/primitives/divider/Divider.tsx:84`, similarly Vue/Solid/Svelte); Solid/Svelte command headers also hardcode `0.05em`.  
    **Fix:** migrate to the canonical variable and remove the exemption at `scripts/audit-tokens.mjs:150-153`.  
    **Gate:** scan quoted CSS variable names, not only `var(...)` expressions.

11. **Anchored panels and tree indentation contain physical inline-axis properties.**  
    Evidence: Solid/Svelte DatePicker, DateRangePicker, MonthPicker, TreeSelect, Cascader and Mentions use `left: 0` (for example `packages/solid/src/primitives/date-picker/IrisDatePicker.tsx:111`, `packages/svelte/src/primitives/cascader/IrisCascader.svelte:226`); Solid Tree uses `padding` with physical left depth (`TreeNode.tsx:67`), Svelte uses `padding-left` (`IrisTree.svelte:372`).  
    **Fix:** use `inset-inline-start`, `padding-inline-start`, and logical borders/margins.  
    **Gate:** RTL snapshots for every anchored primitive and tree depth.

12. **Solid/Svelte carousel arrows do not flip in RTL.**  
    Evidence: Solid `IrisCarousel.tsx:186-196`, Svelte `IrisCarousel.svelte:165-190`; React/Vue use `insetInlineStart/End`.  
    **Fix:** replace physical `left/right` with logical inset properties.  
    **Gate:** compare previous/next edge placement under both directions.

13. **React/Vue Progress fills from physical left.**  
    Evidence: `packages/react/src/primitives/progress/styles.ts:19,25-32` and identical Vue styles.  
    **Fix:** use logical inline-start anchoring and direction-aware indeterminate motion.  
    **Gate:** determinate and indeterminate RTL tests.

14. **Marquee only checks reduced motion at initialization.**  
    Evidence: React `Marquee.tsx:46-48`, Vue `Marquee.ts:34-36`, Solid `IrisMarquee.tsx:38-40`, Svelte `IrisMarquee.svelte:37`. None subscribe to `MediaQueryList.change`.  
    **Fix:** use the existing reactive reduced-motion hooks and cancel/restart Web Animations on preference changes.  
    **Gate:** toggle the media query after mount and assert animation state.

15. **Segmented shadow styling is not themeable in three adapters.**  
    Evidence: raw shadow in React `Segmented.tsx:185`, Vue `Segmented.ts:157`, Svelte `IrisSegmented.svelte:185`; Solid already uses `--iris-shadow-sm` at `IrisSegmented.tsx:216`. Plugin Kanban also contains widespread hardcoded fallbacks, e.g. `packages/plugin-kanban/src/react/index.tsx:166-185`.  
    **Fix:** use canonical shadow tokens and remove unapproved hex/RGBA fallbacks.  
    **Gate:** add `check-hardcoded-colors.mjs` with narrow allowlists for color-picker math and token declarations.

### Recommended shared gates

- Extend `audit-tokens.mjs` to validate CSS variable names in strings and remove the letter-spacing exemption.
- Add logical-property and hardcoded-color static checks with explicit allowlists for coordinates and physical APIs.
- Add a four-framework runtime matrix covering custom themes, RTL, portal rendering, and reduced-motion changes.

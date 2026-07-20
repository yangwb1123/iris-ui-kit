# cms-react E2E tests

Real-browser Playwright tests for the flagship CMS demo (everything else in
the repo runs in jsdom). Config: `../playwright.config.ts`.

- `smoke.spec.ts` — functional: login → shell → data, RBAC, the theme
  toggle's CSS-variable effect. No pixel assertions.
- `visual.spec.ts` — **visual regression** (`toHaveScreenshot`), added
  2026-07-19. This repo's other quality gates (contract tests, a11y audits,
  unit tests) all check behavior/ARIA, never actual rendering, so this is
  the only thing that would catch a CSS/design-token regression shipping
  silently. It's a small, curated set — light vs. dark theme parity on the
  Users page, plus a sorted table with a delete-confirmation Dialog open —
  not exhaustive component coverage. Baselines live in
  `visual.spec.ts-snapshots/` (Playwright's default convention: one PNG per
  screenshot name + project + platform).

## Regenerating baselines

When a visual change is intentional, regenerate and commit the new PNGs:

```sh
cd apps/cms-react
npx playwright test e2e/visual.spec.ts --update-snapshots
```

Review the resulting diffs (`git diff --stat` on the `-snapshots/` PNGs) like
any other change before committing — a baseline update should have an
obvious reason (a real design change), not be a rubber stamp on CI red.

## Tolerance & known limitations

`playwright.config.ts`'s `expect.toHaveScreenshot` sets `threshold: 0.2` +
`maxDiffPixelRatio: 0.02` and disables animations, to absorb ordinary
anti-aliasing/font-rasterization jitter without masking a real regression
(see the comment there for the full reasoning). The project also pins
`channel: 'chrome'` (system Google Chrome) rather than Playwright's bundled
Chromium — required to even install a working browser in some sandboxed dev
environments, and it keeps local and CI (GitHub's `ubuntu-latest`, which
ships Chrome preinstalled) on the same browser family.

Screenshots were verified stable across repeated runs (same baseline, zero
diff, including across a fresh dev-server restart) in the environment they
were generated in. They have **not** yet been proven stable across different
machines/OS font sets — that's exactly why this step is wired into CI as
`continue-on-error: true`, matching the existing "E2E smoke" and "Bench"
steps' convention for unproven-at-scale checks. If CI starts flagging diffs
that are visually a no-op (font hinting, GPU rasterization differences
rather than a real regression), widen `maxDiffPixelRatio` before assuming
the mechanism itself is broken.

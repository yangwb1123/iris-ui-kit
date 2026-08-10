All fixes applied, verified, and reported. Final summary:

---

# Gate-Fix Round 1 — Design Token Correction (Design Spec → Implementation)

## 1. Classification + Assumptions

```json
{
  "product_type": "design-system / component library",
  "page_type": "token surfaces (calendar event chips, kanban WIP badge, dashboard widgets)",
  "platform": "4-framework render layers (react/solid/svelte/vue) + tokens registry",
  "density": "data-dense enterprise",
  "motion_level": "static",
  "primary_user": "host-app consumers overriding via CSS vars",
  "primary_task": "correct the FAIL items from ui_reviewer (1 blocking, 2 Low) + visual_reviewer Low",
  "risk_level": "low — token values only, no API/structural change"
}
```

**Assumptions**: `--iris-on-color` sole consumer = user-colored event chips (verified); `--iris-warning-foreground` sole consumer = kanban WIP badge (verified); `--iris-padding-sm` is a library-wide dense-control token (~30 consumers) → **document, don't retune**; 三态 (loading/empty/error) explicitly out of scope (structural follow-up).

## 2. Information Architecture (geometry contract — per surface)

| Surface                 | Group axis                       | Spacing                                                  | Radius                                                                                   | Contrast fix                                                                          |
| ----------------------- | -------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Event chip (user color) | inline chip on day-cell grid     | `space-xxs` 4px + 4px                                    | **4px** (was 3, aligns kanban chip language)                                             | text `--iris-on-color` **theme-stable #fff** (was near-black in dark ≈1.4:1)          |
| WIP badge (warning)     | kanban column header, count axis | `space-xxs` + `padding-sm` (documented 4–8px micro band) | 4px                                                                                      | `--iris-warning-foreground` **#451a03** light (4.22→6.95:1 AA; dark 8.97:1 unchanged) |
| Dashboard widget        | widget surface, 16px grid        | —                                                        | **6px** = `radius-md` (fallback 8px was off-scale {6,10,16} + drifted from registration) | —                                                                                     |

## 3. Component tree / 4. Operation flow + states

No structural change — fix round on the existing tree. State machine per data region unchanged (三态 gap documented as follow-up; not part of token unification).

## 5. Implementation (code — 11 files)

| File                                 | Change                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `packages/tokens/src/dark.ts`        | `on.color #0b1020 → #ffffff` (theme-stable) + padding-sm exception comment        |
| `packages/tokens/src/light.ts`       | `warning.foreground #78350f → #451a03` + padding-sm exception comment             |
| `plugin-calendar ×4`                 | chip `borderRadius 3 → 4`                                                         |
| `plugin-dashboard ×4`                | widget-radius fallback `8px → 6px` (lockstep with registration)                   |
| `plugin-kanban ×4`                   | WIP-badge fallback `#78350f → #451a03`                                            |
| `packages/tokens/src/themes.test.ts` | stale `+3+8+5` formula → structural list lengths (pre-existing failure, not mine) |

## 6. Self-check vs anti-patterns

- **§2 magic spacing**: none introduced — all values are registered tokens; radius 4px matches established kanban chip language (audit-invisible dimension, disclosed).
- **§6 color/contrast**: both flagged contrast items resolved — dark event chip 1.4:1 → ~15:1 (#fff on any user color ≥ 7:1 for dark colors); light WIP 4.22:1 → 6.95:1 AA; dark unchanged 8.97:1. No bare hex outside `var()` fallbacks.
- **§6c consumer discipline**: registration↔fallback lockstep restored for widget-radius (6=6); on-color now identical in both themes; zero dead registrations (unchanged from prior round).
- **Drift class eliminated**: installed path == standalone path for every touched token.

## Verification (all re-run)

- Audit `--mode all`: **0 / 1391** · `--pkg plugins`: **0 / 115** (exit 0, `plugins.json` regenerated)
- Tests: tokens **24/24** · calendar **45/45** · kanban **43/43** · dashboard **45/45**
- Typecheck: **0 errors** all packages (calendar's 2 warnings = pre-existing a11y, unrelated)
- Git hygiene: no `dist/` / `*.tgz`; nothing committed

**Report**: `docs/ui-audit/gate-fix-1.md`. Verdict-ready: all ui_reviewer blocking + mechanical items fixed; padding-sm resolved via the reviewer-sanctioned documented-exception path; only reviewer-labelled pre-existing follow-ups (三态, `rgba` cal-event-bg accepted) remain, explicitly out of scope.

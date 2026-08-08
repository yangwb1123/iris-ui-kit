Aesthetic review complete. Full report: `/home/u1/iris-ui/docs/ui-audit/aesthetic-review.md` (no library files modified).

## Summary

**Color harmony** — The primary/accent pair (`#6366f1`/`#8b5cf6`, ~19° apart) is genuinely cohesive and dark mode lifts all semantics in lockstep (500→400 levels) — correct discipline. But two real faults: dark-mode solid badges put light `#e2e8f0` text on bright 400-level tones (**1.6–2.2:1 contrast** — Badge.tsx:38-45, the exact "浅底白字" bug the spec warns about), and `info` `#3b82f6` sits only ~22° from primary, reading as "broken primary." `accent` is unused in every primitive (only chart series-2).

**Typography** — The 12→16px run is musically even, but `13px`/`15px` are off-ladder strays (15px has exactly one consumer: TimePicker), Statistic's hero values are untokenized **28/36px**, Badge sm is 11px below the floor, and letter-spacing is inert (no display tracking, `wide 0.02em` unconsumed, label 0.04em hardcoded in 2 places).

**Spacing** — A true 4pt system with documented dense-control exceptions. Weakness: Card md falls back to 16px while the token is **12**, Card lg hardcodes 24 vs Dialog's tokenized 20 — same-family surfaces breathing differently; several hardcoded paddings (EmptyState 32/16, Table state rows 32/12) bypass tokens.

**Shape & depth** — Dialog (radius 12 + two-layer xl shadow) is confident; but `radius.sm: 2` is a knife-edge on tooltip/badge/skeleton, sm/md/lg shadows share one flat 0.1 alpha (dark: one flat 0.4), elevated-card hover doesn't escalate md→md, and **dark mode has no floating-surface step** — overlays are the same `#111827` as cards.

**Motion** — The 150/250/400ms + spring tokens are **dead code**: components hardcode 7 different durations (80–300ms), switch thumb (140ms) desyncs from its track (120ms). Zero entrance animations anywhere — Dialog, Popover, Toast, Tooltip all pop in. Focus-visible rings exist only on Button (20+ files set `outline: none`). Table has no row hover/selected styling. Skeleton shimmer and progress are the exceptions — genuinely polished.

**Top proposals** (full ranking in report): P1 dark badge ink swap, P2 `surface.floating` token, P3 entrance micro-motion for 4 overlays, P4 global focus ring, P5 card padding alignment — all [MECHANICAL], roughly a day of work for the largest visible gain; P11–P15 are [JUDGMENT] (info hue shift, radius.sm 2→4, typography cleanup, EmptyState warmth).

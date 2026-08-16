Baseline complete: **`/home/u1/iris-ui/docs/vxe-grid/batch-cu-baseline.md`** (122 lines). Zero source files touched — `git status` shows only the new baseline plus pre-existing prior-stage dirt (`DECISIONS.md` M, `batch-ct-gate.md` ??), HEAD `985cf0d8` unchanged.

**Key findings from current IrisTable:**

- **Copy has one throat**: `buildRangeCopy(range, format)` (Table.tsx:6455, zero-dep callback) serves both consumption points — Ctrl/Cmd+C (:6667) and the range toolbar 复制 via `copyActiveRange` (:6998), both already threading `clipConfig?.copyFormat ?? 'tsv'`.
- **The "单元格文本" chain already exists**: module-level `contextCellText` (Table.tsx:1930) — mask → formatter (string result only) → `String` fallback — shared verbatim by context-menu 复制值 (batch BW :4909) and cellTooltip (:7444). CU just reuses it; zero new helpers.
- **Formatter contract is masked-input** (types.ts:342-352, batch AY): a formatter always receives the masked value — so the chain is the display text, exactly "复制格式化文本".

**Design** — `clipConfig.copyWithFormat?: boolean` (props.ts:631 inline field, propCount 180 / eventCount 31 unchanged, batch BP precedent). **Formatter-gated**: only columns with a `formatter` switch to the `contextCellText` chain on the copy path; non-formatter columns are byte-identical (blast radius = formatter columns only — eliminates the negative-number neutralization hazard). `buildRangeCopy` gains a 3rd param (keeps the empty-dep memo legal); both call sites pass `!!clipConfig?.copyWithFormat`. All three formats (tsv/csv/html) receive the formatted string through the existing serializers. 8 fiats cover the gate arbitration surface: formatter-input-always-masked superseding `exportRaw`'s copy-path skip (exports unchanged), non-string formatter results falling back like 复制值, paste asymmetry, OWASP neutralization on formatted text, html right-align loss, formula columns via the batch-AO choke point.

**File map** — props.ts +1 field · Table.tsx 3 touch points (buildRangeCopy signature + 2 value branches, 2 call-site args) · types.ts 1 doc sentence · NEW `copy-with-format.test.tsx` · comparison doc 3 spots · manifest regen (180/31 unchanged, clipConfig type string updates).

**Test plan** — react +14 (2604→2618): spec-mandated ① formatter column TSV byte pin (`25.00` not `25`) and ② formatted-not-raw (`$25`); plus toolbar same-throat, no-formatter byte regression, mask→formatter order, exportRaw combination, non-string fallback, csv quoting + OWASP, html escaping, copyFormat orthogonality, row-aware formatter, paste asymmetry, no-range no-op, formula+formatter.

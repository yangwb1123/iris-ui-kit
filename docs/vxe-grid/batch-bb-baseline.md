Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-bb-baseline.md` (183 lines). Zero source files touched — `git status` shows only the new doc.

**What's in it (every claim verified against current code):**

- **Proposed design:**
  - **a)** `onAnnotationsChange?: (next: Record<string, string>) => void` — single-line controlled write channel mirroring `onFiltersChange`; annotations stay fully controlled (no internal table state, documented).
  - **b)** `annotationEditing?: boolean` — context menu gains built-in items 添加批注 (`__iris-annotate`) / 编辑批注 (`__iris-annotate-edit`) / 删除批注 (`__iris-annotate-remove`), deduped and intercepted at the `onSelect` wiring exactly like the batch AM/AW built-ins (Table.tsx:7239-7242); selection opens a `TableAnnotatePanel` (`data-iris-annotate-panel`) cloned from the DistributionPanel mold — same virtual cursor anchor, `useFloating`+`useDismiss`+portal, Esc/outside/scroll close; textarea `data-iris-annotate-input` seeded from `annotations[cellKey]`, 保存 `data-iris-annotate-save` (empty text removes the key), 删除 `data-iris-annotate-remove` only when a note exists.
  - **c)** i18n `table.annotate` / `.edit` / `.remove` / `.save` — en (core i18n.ts:126) + zh (plugin-locale-zh:64).
- **Key verified anchors:** cell key = `cellId(rowKeyOf(row, idx), col.key)` (the exact AZ lookup at :5026), reserved-key consts next to `DISTRIBUTION_MENU_KEY`:636/`SUMMARY_MENU_KEY`:641, panel state clone point :2673-2687, props.ts slots :470/:475.
- **File map:** 2 new files (AnnotatePanel.tsx + annotate-editing.test.tsx with 8 test cases), 4 edits (Table.tsx, props.ts, both i18n dictionaries).
- **10 numbered fiats for gate arbitration**, including the flagged call: items gate on `annotationEditing && onAnnotationsChange` (fail-closed — a menu item that can't write is a dead end), and the `cellNote`-dynamic-note boundary (display-only, edits write `annotations` only).

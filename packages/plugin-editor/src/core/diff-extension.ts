import { RangeSetBuilder, StateEffect } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view'
import { computeDiff } from './diff'

/**
 * State effect to update the diff base text on a running editor.
 * Dispatch this when the base text changes (e.g. controlled from above).
 */
export const setDiffBase = StateEffect.define<string>()

/**
 * Build a CodeMirror 6 ViewPlugin that shows an inline diff of the
 * current document against `base`. Added lines get a green background
 * (`cm-diff-added`), and lines that differ get a yellow left-border
 * (`cm-diff-modified`).
 *
 * Usage:
 * ```ts
 * import { diffViewPlugin } from './diff-extension'
 * const view = new EditorView({
 *   state: EditorState.create({
 *     doc: newText,
 *     extensions: [diffViewPlugin(oldText)],
 *   }),
 *   parent: el,
 * })
 * ```
 */
export function diffViewPlugin(base: string) {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet

        constructor(view: EditorView) {
          this.decorations = buildDecorations(view, base)
        }

        update(update: ViewUpdate) {
          for (const effect of update.transactions) {
            for (const e of effect.effects) {
              if (e.is(setDiffBase)) {
                this.decorations = buildDecorations(update.view, e.value)
                return
              }
            }
          }
          if (update.docChanged) {
            this.decorations = buildDecorations(update.view, base)
          }
        }
      },
      { decorations: (v) => v.decorations },
    ),
    EditorView.theme({
      '.cm-diff-added': {
        backgroundColor: 'var(--iris-editor-diff-added-bg, rgba(40, 160, 80, 0.15))',
      },
      '.cm-diff-removed': {
        backgroundColor: 'var(--iris-editor-diff-removed-bg, rgba(220, 60, 60, 0.12))',
      },
    }),
  ]
}

function buildDecorations(view: EditorView, base: string): DecorationSet {
  const current = view.state.doc.toString()
  const diff = computeDiff(current, base)
  const builder = new RangeSetBuilder<Decoration>()

  for (const item of diff) {
    if (item.kind === 'unchanged') continue

    const line = view.state.doc.line(item.line)
    const cls = item.kind === 'added' ? 'cm-diff-added' : 'cm-diff-removed'
    builder.add(line.from, line.from, Decoration.line({ class: cls }))
  }

  return builder.finish()
}

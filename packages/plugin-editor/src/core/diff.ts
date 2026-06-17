/**
 * Simple line-by-line diff for the editor's inline diff view.
 * Uses a standard LCS (Longest Common Subsequence) approach to
 * annotate each line in the current text as added, removed, or unchanged
 * relative to a `base` text. Independent of CodeMirror — produces a
 * `DiffLine[]` that decorations can consume.
 */

export type DiffKind = 'unchanged' | 'added' | 'removed'

export interface DiffLine {
  kind: DiffKind
  /** 1-based line number in the current document (0 for removed lines). */
  line: number
}

/**
 * Compute a line-level diff of `current` vs `base`.
 * Returns `DiffLine[]` where each entry corresponds to a line in the
 * current text, annotated with whether it was added or unchanged.
 * (Removed lines only show up as "removed" entries with line=0.)
 */
export function computeDiff(current: string, base: string): DiffLine[] {
  const curLines = current.split('\n')
  const baseLines = base.split('\n')

  // Handle trivial cases
  if (current === base) {
    return curLines.map((_, i) => ({ kind: 'unchanged' as const, line: i + 1 }))
  }
  if (base === '') {
    return curLines.map((_, i) => ({ kind: 'added' as const, line: i + 1 }))
  }
  if (current === '') {
    return [{ kind: 'removed', line: 0 }]
  }

  // Compute LCS table
  const m = curLines.length
  const n = baseLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        curLines[i - 1] === baseLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = []
  let i = m,
    j = n
  const reverseResult: DiffLine[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && curLines[i - 1] === baseLines[j - 1]) {
      reverseResult.push({ kind: 'unchanged', line: i })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // Line removed from base — not present in current
      reverseResult.push({ kind: 'removed', line: 0 })
      j--
    } else {
      // Line added in current
      reverseResult.push({ kind: 'added', line: i })
      i--
    }
  }

  // Filter: only keep lines present in current (added + unchanged)
  // Removed lines are skipped since they don't exist in the current doc
  for (const item of reverseResult.reverse()) {
    if (item.kind !== 'removed') {
      result.push(item)
    }
  }

  return result
}

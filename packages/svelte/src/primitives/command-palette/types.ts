export interface IrisCommandItem {
  id: string
  label: string
  keywords?: string[]
  group?: string
  icon?: string
  shortcut?: string
  disabled?: boolean
  action?: () => void
}

export function defaultFilter(query: string, item: IrisCommandItem): number | null {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const haystacks: string[] = [item.label, ...(item.keywords ?? [])].map((s) => s.toLowerCase())
  let best: number | null = null
  for (const h of haystacks) {
    let qi = 0
    let lastIdx = -1
    let score = 0
    for (let i = 0; i < h.length && qi < q.length; i += 1) {
      if (h[i] === q[qi]) {
        score += lastIdx === -1 ? i : i - lastIdx - 1
        lastIdx = i
        qi += 1
      }
    }
    if (qi === q.length) {
      if (best === null || score < best) best = score
    }
  }
  return best
}

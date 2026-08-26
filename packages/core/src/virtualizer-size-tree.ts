/**
 * Fenwick (binary-indexed) tree over per-item sizes: O(log n) point update and
 * prefix-sum (item offset), plus an O(log n) lower-bound to find the item at a
 * pixel offset. This is what makes `measure` and the per-scroll window cheap at
 * 100k rows instead of an O(n) cumulative-offset rebuild.
 */
export interface SizeTree {
  prefix(index: number): number
  set(index: number, size: number): boolean
  lowerBound(target: number): number
  sizeOf(index: number): number
  total(): number
  reset(count: number): void
  readonly count: number
  snapshotSizes(): number[]
}

class FenwickSizeTree implements SizeTree {
  private n: number
  private sizes: number[]
  private tree: number[]

  constructor(
    private readonly sizeAt: (index: number) => number,
    count: number,
  ) {
    this.n = count
    this.sizes = []
    this.tree = []
    this.build()
  }

  private build(): void {
    this.sizes = new Array<number>(this.n)
    this.tree = new Array<number>(this.n + 1).fill(0)
    for (let i = 0; i < this.n; i++) {
      const size = Math.max(0, this.sizeAt(i))
      this.sizes[i] = size
      this.tree[i + 1] += size
      const parent = i + 1 + ((i + 1) & -(i + 1) || 0)
      if (parent <= this.n) this.tree[parent] += this.tree[i + 1]
    }
  }

  prefix(index: number): number {
    let sum = 0
    for (let cursor = index; cursor > 0; cursor -= cursor & -cursor) sum += this.tree[cursor]
    return sum
  }

  set(index: number, size: number): boolean {
    if (index < 0 || index >= this.n) return false
    const next = Math.max(0, size)
    const delta = next - this.sizes[index]
    if (delta === 0) return false
    this.sizes[index] = next
    for (let cursor = index + 1; cursor <= this.n; cursor += cursor & -cursor) {
      this.tree[cursor] += delta
    }
    return true
  }

  lowerBound(target: number): number {
    let pos = 0
    let remaining = target
    let power = 1
    while (power * 2 <= this.n) power *= 2
    for (; power > 0; power >>= 1) {
      if (pos + power <= this.n && this.tree[pos + power] <= remaining) {
        pos += power
        remaining -= this.tree[pos]
      }
    }
    return pos
  }

  sizeOf(index: number): number {
    return this.sizes[index] ?? 0
  }

  total(): number {
    return this.prefix(this.n)
  }

  reset(count: number): void {
    this.n = count
    this.build()
  }

  get count(): number {
    return this.n
  }

  snapshotSizes(): number[] {
    return [...this.sizes]
  }
}

export function createSizeTree(count: number, sizeAt: (index: number) => number): SizeTree {
  return new FenwickSizeTree(sizeAt, count)
}

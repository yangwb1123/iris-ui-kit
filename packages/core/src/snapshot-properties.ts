/** Copy enumerable string keys in recursive read order, without inherited setters. */
export function copySnapshotProperties<Context>(
  value: object,
  copy: Record<string, unknown>,
  clone: (value: unknown, context: Context) => unknown,
  context: Context,
): void {
  for (const key of Object.keys(value)) {
    const entry = clone((value as Record<string, unknown>)[key], context)
    // Check after cloning: getters can install prototype setters. Only a plain
    // target with a missing key can create a data property via assignment.
    // Custom prototypes (including proxies) retain the descriptor-only path.
    const prototype = Object.getPrototypeOf(copy)
    if ((prototype === null || prototype === Object.prototype) && !(key in copy)) {
      copy[key] = entry
    } else {
      Object.defineProperty(copy, key, {
        value: entry,
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
  }
}

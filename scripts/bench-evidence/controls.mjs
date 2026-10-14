// DELIBERATELY INCOMPATIBLE DIAGNOSTIC CONTROLS. Never a runtime fallback.
// No cache, TTL, deduplication, LRU, generation tracking or cancellation API.
const mode = process.env.IRIS_BENCH_VARIANT
if (!['native-control', 'fetcher-control'].includes(mode))
  throw new Error('Invalid diagnostic control')

export function createQueryCache() {
  return {
    fetch(key, fetcher) {
      // Both construction and signal access remain INSIDE each measured fetch.
      return fetcher(key, mode === 'native-control' ? new AbortController().signal : undefined)
    },
  }
}

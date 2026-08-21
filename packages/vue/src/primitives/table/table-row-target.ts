export function createTableRowTarget(root: () => HTMLElement | null): {
  find: (key: string | number) => HTMLElement | null
  scrollTo: (key: string | number) => void
  goTo: (key: string | number) => void
  dispose: () => void
} {
  let timer: ReturnType<typeof setTimeout> | null = null
  const find = (key: string | number): HTMLElement | null => {
    const element = root()
    if (!element) return null
    const keyString = String(key)
    return (
      Array.from(element.querySelectorAll<HTMLElement>('[data-iris-table-row-key]')).find(
        (node) => node.getAttribute('data-iris-table-row-key') === keyString,
      ) ?? null
    )
  }
  const scrollTo = (key: string | number): void => {
    find(key)?.scrollIntoView?.({ block: 'nearest' })
  }
  const goTo = (key: string | number): void => {
    const row = find(key)
    if (!row) return
    row.scrollIntoView?.({ block: 'nearest' })
    root()?.querySelector('[data-iris-row-target="true"]')?.removeAttribute('data-iris-row-target')
    row.setAttribute('data-iris-row-target', 'true')
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      row.removeAttribute('data-iris-row-target')
    }, 2000)
  }
  const dispose = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  return { find, scrollTo, goTo, dispose }
}

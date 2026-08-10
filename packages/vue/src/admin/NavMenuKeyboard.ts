import type { NavNode } from '@iris-ui-kit/core'
import { findNavNode, findNavPath, isBranch } from '@iris-ui-kit/core'
import { nextTick, type Ref } from 'vue'

/**
 * Keyboard navigation for IrisNavMenu (WAI-ARIA menu pattern, aligned with
 * ant-design-vue Menu): ArrowUp/Down/Home/End move focus, ArrowRight opens a
 * flyout branch and steps in, ArrowLeft/Up close, Escape closes flyouts and
 * returns focus to the trigger (A3/A4/A5).
 */
export interface NavMenuKeydownDeps {
  items: NavNode[]
  flyoutMode: () => boolean
  expanded: () => string[]
  toggle: (key: string) => void
  openFlyout: (key: string) => void
  closeHorizontalMenus: () => void
  horizontalBranchVisible: (key: string, depth: number) => boolean
  setBranchInteraction: (state: Ref<string[]>, key: string, enabled: boolean) => void
  focusedBranches: Ref<string[]>
  collapsed: boolean
  hoveredBranches: Ref<string[]>
  clickedBranches: Ref<string[]>
  suppressFocusOpen: () => boolean
  setSuppressFocusOpen: (value: boolean) => void
}

export function createNavMenuKeydownHandler(deps: NavMenuKeydownDeps) {
  const {
    items,
    flyoutMode,
    expanded,
    toggle,
    openFlyout,
    closeHorizontalMenus,
    horizontalBranchVisible,
    setBranchInteraction,
    focusedBranches,
    collapsed,
    hoveredBranches,
    clickedBranches,
    setSuppressFocusOpen,
  } = deps

  return (e: KeyboardEvent): void => {
    const root = e.currentTarget as HTMLElement
    const buttons = Array.from(root.querySelectorAll<HTMLElement>('[data-iris-nav-item]')).filter(
      (button) => !button.closest('[data-iris-nav-children][aria-hidden="true"]'),
    )
    if (buttons.length === 0) return
    const idx = buttons.indexOf(document.activeElement as HTMLElement)
    const focusAt = (i: number): void => buttons[(i + buttons.length) % buttons.length]?.focus()
    const key = idx >= 0 ? buttons[idx]?.getAttribute('data-key') : undefined
    const node = key ? findNavNode(items, key) : undefined
    const depth = idx >= 0 ? Number(buttons[idx]?.getAttribute('data-depth') ?? 0) : 0

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        // A4: flyout mode — Down on a branch opens its popup and steps in.
        if (flyoutMode() && node && isBranch(node)) {
          openFlyout(key!)
          const group = buttons[idx]!.closest('[data-iris-nav-group]')
          void nextTick(() => {
            group
              ?.querySelector<HTMLElement>('[data-iris-nav-children] [data-iris-nav-item]')
              ?.focus()
          })
          return
        }
        focusAt(idx < 0 ? 0 : idx + 1)
        return
      }
      case 'ArrowUp': {
        e.preventDefault()
        // A4: Up on an open flyout trigger closes it and keeps focus there
        // (clears the click-pinned state too, so ArrowUp closes pinned popups
        // exactly like ArrowLeft).
        if (flyoutMode() && node && isBranch(node) && horizontalBranchVisible(key!, depth)) {
          setBranchInteraction(focusedBranches, key!, false)
          setBranchInteraction(clickedBranches, key!, false)
          return
        }
        focusAt(idx < 0 ? buttons.length - 1 : idx - 1)
        return
      }
      case 'Home':
        e.preventDefault()
        buttons[0]?.focus()
        return
      case 'End':
        e.preventDefault()
        buttons[buttons.length - 1]?.focus()
        return
      case 'Escape': {
        // A3: Escape closes open flyouts and returns focus to the trigger.
        if (flyoutMode()) {
          const openKeys = [
            ...hoveredBranches.value,
            ...clickedBranches.value,
            ...focusedBranches.value,
          ]
          if (openKeys.length > 0) {
            e.preventDefault()
            const openTop = openKeys.find((k) => findNavPath(items, k).length === 1)
            closeHorizontalMenus()
            if (openTop) {
              setSuppressFocusOpen(true)
              buttons.find((b) => b.getAttribute('data-key') === openTop)?.focus()
              void nextTick(() => {
                setSuppressFocusOpen(false)
              })
            }
          }
        }
        return
      }
    }

    if (collapsed || idx < 0 || !key || !node) return

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (isBranch(node)) {
        if (flyoutMode() || !expanded().includes(key)) {
          // A4 (flyout) / A5 (vertical): open and step into the first child.
          if (flyoutMode()) openFlyout(key)
          else toggle(key)
          const group = buttons[idx]!.closest('[data-iris-nav-group]')
          void nextTick(() => {
            group
              ?.querySelector<HTMLElement>('[data-iris-nav-children] [data-iris-nav-item]')
              ?.focus()
          })
        } else {
          focusAt(idx + 1)
        }
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (flyoutMode() && isBranch(node)) {
        setBranchInteraction(focusedBranches, key, false)
        setBranchInteraction(clickedBranches, key, false)
        return
      }
      if (isBranch(node) && expanded().includes(key)) {
        toggle(key)
      } else {
        const parentKey = findNavPath(items, key).at(-2)?.key
        if (parentKey) {
          buttons.find((b) => b.getAttribute('data-key') === parentKey)?.focus()
        }
      }
    }
  }
}

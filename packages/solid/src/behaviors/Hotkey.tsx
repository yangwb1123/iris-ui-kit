import { createEffect, onCleanup, type JSX } from 'solid-js'

function parseShortcut(spec: string): {
  key: string
  shift: boolean
  alt: boolean
  ctrl: boolean
  meta: boolean
  ctrlOrMeta: boolean
} {
  const parts = spec.split('+').map((p) => p.trim())
  const key = parts[parts.length - 1]!.toLowerCase()
  const mods = new Set(parts.slice(0, -1).map((p) => p.toLowerCase()))
  return {
    key,
    shift: mods.has('shift'),
    alt: mods.has('alt') || mods.has('option'),
    ctrl: mods.has('ctrl') || mods.has('control'),
    meta: mods.has('meta') || mods.has('cmd') || mods.has('command'),
    ctrlOrMeta: mods.has('mod'),
  }
}

function isInputTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

function matches(event: KeyboardEvent, parsed: ReturnType<typeof parseShortcut>): boolean {
  if (event.key.toLowerCase() !== parsed.key) return false
  if (parsed.shift !== event.shiftKey) return false
  if (parsed.alt !== event.altKey) return false
  if (parsed.ctrlOrMeta) {
    if (!event.ctrlKey && !event.metaKey) return false
  } else {
    if (parsed.ctrl !== event.ctrlKey) return false
    if (parsed.meta !== event.metaKey) return false
  }
  return true
}

export interface IrisHotkeyProps {
  shortcut: string | string[]
  disabled?: boolean
  allowInInputs?: boolean
  scope?: 'document' | 'window'
  onTrigger?: (event: KeyboardEvent) => void
  children?: JSX.Element
}

/**
 * Behavior wrapper: binds a global keyboard shortcut while children are
 * mounted. Renderless — returns children verbatim.
 * Solid port of the Vue IrisHotkey.
 */
export function IrisHotkey(props: IrisHotkeyProps): JSX.Element {
  createEffect(() => {
    if (props.disabled) return

    const specs = Array.isArray(props.shortcut) ? props.shortcut : [props.shortcut]
    const parsed = specs.map(parseShortcut)
    const target: EventTarget = (props.scope ?? 'document') === 'window' ? window : document

    const onKey = (event: Event) => {
      const e = event as KeyboardEvent
      if (!props.allowInInputs && isInputTarget(e.target)) return
      for (const p of parsed) {
        if (matches(e, p)) {
          props.onTrigger?.(e)
          return
        }
      }
    }

    target.addEventListener('keydown', onKey)
    onCleanup(() => target.removeEventListener('keydown', onKey))
  })

  return props.children as JSX.Element
}

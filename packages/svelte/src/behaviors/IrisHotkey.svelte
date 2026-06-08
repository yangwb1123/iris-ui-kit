<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Parsed {
    key: string
    shift: boolean
    alt: boolean
    ctrl: boolean
    meta: boolean
    ctrlOrMeta: boolean
  }

  function parseShortcut(spec: string): Parsed {
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

  function matchesParsed(event: KeyboardEvent, parsed: Parsed): boolean {
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

  interface Props {
    shortcut: string | string[]
    disabled?: boolean
    allowInInputs?: boolean
    scope?: 'document' | 'window'
    onTrigger?: (e: KeyboardEvent) => void
    children?: Snippet
  }

  let {
    shortcut,
    disabled = false,
    allowInInputs = false,
    scope = 'document',
    onTrigger,
    children,
  }: Props = $props()

  $effect(() => {
    if (disabled) return
    const specs = Array.isArray(shortcut) ? shortcut : [shortcut]
    const parsed = specs.map(parseShortcut)
    const target: EventTarget = scope === 'window' ? window : document

    const onKey = (event: Event) => {
      const e = event as KeyboardEvent
      if (!allowInInputs && isInputTarget(e.target)) return
      for (const p of parsed) {
        if (matchesParsed(e, p)) {
          onTrigger?.(e)
          return
        }
      }
    }

    target.addEventListener('keydown', onKey)
    return () => target.removeEventListener('keydown', onKey)
  })
</script>

{@render children?.()}

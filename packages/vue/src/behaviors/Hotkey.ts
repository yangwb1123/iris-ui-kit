import { defineComponent, onBeforeUnmount, watchEffect, type PropType } from 'vue'

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

/**
 * Behavior wrapper: binds a global keyboard shortcut while children are
 * mounted. Renderless — returns children verbatim via a Fragment.
 *
 * `shortcut` format: `'Escape'`, `'Mod+s'` (Mod = Ctrl on Win/Linux, Cmd on
 * macOS), `'Shift+/'`. Accepts a single string or array of strings.
 *
 * @example
 *   <IrisHotkey shortcut="Escape" @trigger="close">
 *     <IrisDialog>…</IrisDialog>
 *   </IrisHotkey>
 */
export const IrisHotkey = defineComponent({
  name: 'IrisHotkey',
  inheritAttrs: false,
  props: {
    shortcut: { type: [String, Array] as PropType<string | string[]>, required: true },
    disabled: { type: Boolean, default: false },
    allowInInputs: { type: Boolean, default: false },
    scope: { type: String as PropType<'document' | 'window'>, default: 'document' },
  },
  emits: {
    trigger: (_event: KeyboardEvent) => true,
  },
  setup(props, { slots, emit }) {
    let detach: (() => void) | null = null

    watchEffect((onCleanup) => {
      detach?.()
      detach = null
      if (props.disabled) return
      const specs = Array.isArray(props.shortcut) ? props.shortcut : [props.shortcut]
      const parsed = specs.map(parseShortcut)
      const target: EventTarget = props.scope === 'window' ? window : document
      const onKey = (event: Event) => {
        const e = event as KeyboardEvent
        if (!props.allowInInputs && isInputTarget(e.target)) return
        for (const p of parsed) {
          if (matches(e, p)) {
            emit('trigger', e)
            return
          }
        }
      }
      target.addEventListener('keydown', onKey)
      detach = () => target.removeEventListener('keydown', onKey)
      onCleanup(() => detach?.())
    })

    onBeforeUnmount(() => detach?.())

    return () => slots.default?.()
  },
})

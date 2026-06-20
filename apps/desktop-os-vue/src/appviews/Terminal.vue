<script setup lang="ts">
/**
 * A faux shell: an input line + scrollback. `appNames` is passed in (rather than
 * imported from the catalog) so this view stays self-contained and avoids a
 * cycle — the Vue twin of the React `TerminalApp`.
 */
import { ref, nextTick, watch } from 'vue'

interface Line {
  id: number
  /** `'in'` = the echoed command prompt, `'out'` = command output. */
  kind: 'in' | 'out'
  text: string
}

const props = defineProps<{ appNames: string[] }>()

const BANNER = "iris-sh — type 'help' for commands."

const HELP = [
  'Available commands:',
  '  help          show this help',
  '  apps          list installed apps',
  '  echo <text>   print <text>',
  '  about         about this shell',
  '  clear         clear the screen',
].join('\n')

const ABOUT = 'iris-sh v1.0 — a faux shell running inside an Iris OS window.'

const lines = ref<Line[]>([{ id: 0, kind: 'out', text: BANNER }])
const input = ref('')
const scrollRef = ref<HTMLDivElement | null>(null)
let nextId = 1

watch(
  lines,
  () => {
    void nextTick(() => {
      const el = scrollRef.value
      if (el) el.scrollTop = el.scrollHeight
    })
  },
  { deep: true },
)

function push(kind: Line['kind'], text: string): void {
  lines.value.push({ id: nextId++, kind, text })
}

function run(raw: string): void {
  const cmd = raw.trim()
  push('in', `$ ${raw}`)
  if (cmd === '') return

  const name = cmd.split(/\s+/)[0]
  const arg = cmd.slice(name.length).trim()

  switch (name) {
    case 'help':
      push('out', HELP)
      break
    case 'apps':
      push('out', props.appNames.map((a) => `  • ${a}`).join('\n'))
      break
    case 'echo':
      push('out', arg)
      break
    case 'about':
      push('out', ABOUT)
      break
    case 'clear':
      lines.value = []
      break
    default:
      push('out', `iris-sh: command not found: ${name}. Try 'help'.`)
      break
  }
}

function onSubmit(): void {
  run(input.value)
  input.value = ''
}
</script>

<template>
  <div class="term">
    <div ref="scrollRef" class="term-scroll">
      <pre v-for="l in lines" :key="l.id" class="term-line" :data-kind="l.kind">{{ l.text }}</pre>
    </div>
    <form class="term-form" @submit.prevent="onSubmit">
      <span aria-hidden class="term-prompt">$</span>
      <input
        v-model="input"
        aria-label="Terminal input"
        autocomplete="off"
        :spellcheck="false"
        class="term-input"
      />
    </form>
  </div>
</template>

<style scoped>
.term {
  height: 100%;
  box-sizing: border-box;
  display: grid;
  grid-template-rows: 1fr auto;
  background: #0b0e14;
  color: #cdd6f4;
  font:
    13px/1.5 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
}
.term-scroll {
  overflow: auto;
  padding: 12px;
}
.term-line {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #cdd6f4;
}
.term-line[data-kind='in'] {
  color: #a6e3a1;
}
.term-form {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.term-prompt {
  color: #a6e3a1;
}
.term-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  font: inherit;
}
</style>

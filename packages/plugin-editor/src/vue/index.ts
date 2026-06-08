import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { createEditor, type EditorHandle, type EditorLanguage } from '../core'

export type { EditorLanguage } from '../core'

/**
 * CodeMirror 6 code editor for Vue. Authored as a render function (matching the
 * `@iris-ui/vue` convention — no `.vue` SFCs). Supports `v-model:value`.
 */
export const IrisCodeEditor = defineComponent({
  name: 'IrisCodeEditor',
  props: {
    value: { type: String as PropType<string | undefined>, default: undefined },
    defaultValue: { type: String, default: '' },
    language: { type: String as PropType<EditorLanguage>, default: 'plain' },
    readOnly: { type: Boolean, default: false },
  },
  emits: {
    'update:value': (_value: string) => true,
    change: (_value: string) => true,
  },
  setup(props, { emit }) {
    const host = ref<HTMLDivElement | null>(null)
    let handle: EditorHandle | null = null

    onMounted(() => {
      if (!host.value) return
      handle = createEditor({
        parent: host.value,
        doc: props.value ?? props.defaultValue,
        language: props.language,
        readOnly: props.readOnly,
        onChange: (v) => {
          emit('update:value', v)
          emit('change', v)
        },
      })
    })

    onBeforeUnmount(() => {
      handle?.destroy()
      handle = null
    })

    watch(
      () => props.value,
      (v) => {
        if (v !== undefined && handle && handle.getValue() !== v) handle.setValue(v)
      },
    )
    watch(
      () => props.language,
      (l) => handle?.setLanguage(l),
    )
    watch(
      () => props.readOnly,
      (r) => handle?.setReadOnly(r),
    )

    return () => h('div', { ref: host, 'data-iris-code-editor': '' })
  },
})

import {
  defineComponent,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
} from 'vue'
import { PluginStoreContextKey } from '@iris-ui-kit/vue/provider'
import {
  createEditor,
  resolveEditorSettings,
  type EditorHandle,
  type EditorLanguage,
  type EditorSettingsStore,
} from '../core'

export {
  createEditorPlugin,
  createEditorSettingsStore,
  editorPlugin,
  type EditorLanguage,
  type EditorSettings,
  type EditorSettingsStore,
} from '../core'

/**
 * CodeMirror 6 code editor for Vue. Authored as a render function (matching the
 * `@iris-ui-kit/vue` convention — no `.vue` SFCs). Supports `v-model:value`.
 */
export const IrisCodeEditor = defineComponent({
  name: 'IrisCodeEditor',
  props: {
    value: { type: String as PropType<string | undefined>, default: undefined },
    defaultValue: { type: String, default: '' },
    language: { type: String as PropType<EditorLanguage | undefined>, default: undefined },
    tabSize: { type: Number, default: undefined },
    readOnly: { type: Boolean, default: false },
    completions: { type: Boolean, default: undefined },
    base: { type: String, default: undefined },
  },
  emits: {
    'update:value': (_value: string) => true,
    change: (_value: string) => true,
  },
  setup(props, { emit }) {
    const pluginContext = inject(PluginStoreContextKey, null)
    const settingsStore = pluginContext?.stores.get('editor') as EditorSettingsStore | undefined
    const settings = shallowRef(settingsStore?.getState() ?? resolveEditorSettings())
    const unsubscribeSettings = settingsStore?.subscribe((next) => {
      settings.value = next
    })
    const activeLanguage = () => props.language ?? settings.value.defaultLanguage
    const activeTabSize = () => props.tabSize ?? settings.value.tabSize

    const host = ref<HTMLDivElement | null>(null)
    let handle: EditorHandle | null = null

    onMounted(() => {
      if (!host.value) return
      handle = createEditor({
        parent: host.value,
        doc: props.value ?? props.defaultValue,
        language: activeLanguage(),
        tabSize: activeTabSize(),
        readOnly: props.readOnly,
        completions: props.completions,
        base: props.base,
        onChange: (v) => {
          emit('update:value', v)
          emit('change', v)
        },
      })
    })

    onBeforeUnmount(() => {
      handle?.destroy()
      handle = null
      unsubscribeSettings?.()
    })

    watch(
      () => props.value,
      (v) => {
        if (v !== undefined && handle && handle.getValue() !== v) handle.setValue(v)
      },
    )
    watch(activeLanguage, (l) => handle?.setLanguage(l))
    watch(activeTabSize, (size) => handle?.setTabSize(size))
    watch(
      () => props.readOnly,
      (r) => handle?.setReadOnly(r),
    )

    return () =>
      h('div', {
        ref: host,
        'data-iris-code-editor': '',
        'data-language': activeLanguage(),
        'data-tab-size': activeTabSize(),
      })
  },
})

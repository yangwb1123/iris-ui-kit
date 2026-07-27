<script lang="ts">
  import { IrisProvider } from '@iris-ui-kit/svelte/provider'
  import { createEditorPlugin } from '../core'
  import IrisCodeEditor from './IrisCodeEditor.svelte'

  const plugin = createEditorPlugin({ defaultLanguage: 'sql', tabSize: 6 })
</script>

<IrisProvider plugins={[plugin]}>
  {#snippet children()}
    <IrisCodeEditor defaultValue="SELECT 1" />
  {/snippet}
</IrisProvider>

<script setup lang="ts">
import { ref } from 'vue'
import {
  IrisButton,
  IrisDialog,
  IrisDialogTrigger,
  IrisDialogContent,
  IrisDialogTitle,
  IrisDialogDescription,
  IrisDialogClose,
  IrisDrawer,
  IrisDrawerContent,
  IrisDrawerTitle,
  IrisDrawerClose,
  IrisMenu,
  IrisMenuTrigger,
  IrisMenuContent,
  IrisMenuItem,
  IrisMenuSub,
  IrisCommandPalette,
  useToast,
  IrisKbd,
  type IrisCommandItem,
} from '@iris-ui-kit/vue'

const dialogOpen = ref(false)
const drawerOpen = ref(false)
const drawerSide = ref<'left' | 'right' | 'top' | 'bottom'>('right')
const cmdOpen = ref(false)

const toast = useToast()

const commands: IrisCommandItem[] = [
  {
    id: 'open',
    label: 'Open File',
    group: 'File',
    shortcut: '⌘O',
    action: () => toast.info({ title: 'Open File' }),
  },
  {
    id: 'save',
    label: 'Save File',
    group: 'File',
    shortcut: '⌘S',
    action: () => toast.success({ title: 'Saved' }),
  },
  {
    id: 'theme',
    label: 'Toggle Theme',
    group: 'View',
    keywords: ['dark', 'light'],
    shortcut: '⌘T',
    action: () => toast.info({ title: 'Theme toggled' }),
  },
  {
    id: 'preferences',
    label: 'Open Preferences',
    group: 'View',
    disabled: true,
  },
]
</script>

<template>
  <section class="section">
    <h2 class="section-title">Overlay Components</h2>

    <div class="row">
      <span class="row-label">dialog</span>
      <IrisDialog v-model:open="dialogOpen">
        <IrisDialogTrigger as-child>
          <IrisButton variant="outline">Open dialog</IrisButton>
        </IrisDialogTrigger>
        <IrisDialogContent>
          <IrisDialogTitle>Confirm action</IrisDialogTitle>
          <IrisDialogDescription>
            Focus is trapped inside, body scroll is locked, and Escape / backdrop click both
            dismiss.
          </IrisDialogDescription>
          <div style="display: flex; gap: var(--iris-gap-md); justify-content: flex-end">
            <IrisDialogClose as-child>
              <IrisButton variant="ghost">Cancel</IrisButton>
            </IrisDialogClose>
            <IrisDialogClose as-child>
              <IrisButton variant="solid">Confirm</IrisButton>
            </IrisDialogClose>
          </div>
        </IrisDialogContent>
      </IrisDialog>
    </div>

    <div class="row">
      <span class="row-label">drawer</span>
      <IrisButton
        v-for="s in ['left', 'right', 'top', 'bottom'] as const"
        :key="s"
        size="sm"
        variant="outline"
        @click="
          () => {
            drawerSide = s
            drawerOpen = true
          }
        "
      >
        from {{ s }}
      </IrisButton>
      <IrisDrawer v-model:open="drawerOpen" :side="drawerSide">
        <IrisDrawerContent>
          <IrisDrawerTitle>Settings</IrisDrawerTitle>
          <div style="padding: 16px">
            <p style="margin: 0 0 12px 0">
              Drawer is opened from <strong>{{ drawerSide }}</strong
              >.
            </p>
            <IrisDrawerClose as-child>
              <IrisButton variant="ghost">Close</IrisButton>
            </IrisDrawerClose>
          </div>
        </IrisDrawerContent>
      </IrisDrawer>
    </div>

    <div class="row">
      <span class="row-label">menu</span>
      <IrisMenu>
        <IrisMenuTrigger as-child>
          <IrisButton variant="outline">Actions ▾</IrisButton>
        </IrisMenuTrigger>
        <IrisMenuContent>
          <IrisMenuItem @select="() => toast.info({ title: 'Cut' })">Cut</IrisMenuItem>
          <IrisMenuItem @select="() => toast.info({ title: 'Copy' })">Copy</IrisMenuItem>
          <IrisMenuItem @select="() => toast.info({ title: 'Paste' })">Paste</IrisMenuItem>
          <IrisMenuSub label="More…">
            <IrisMenuItem @select="() => toast.info({ title: 'Paste Special' })"
              >Paste Special</IrisMenuItem
            >
            <IrisMenuItem @select="() => toast.info({ title: 'Paste From History' })"
              >Paste From History</IrisMenuItem
            >
          </IrisMenuSub>
        </IrisMenuContent>
      </IrisMenu>
    </div>

    <div class="row">
      <span class="row-label">toast</span>
      <IrisButton size="sm" variant="outline" @click="toast.info({ title: 'Hello' })"
        >info</IrisButton
      >
      <IrisButton size="sm" variant="outline" @click="toast.success({ title: 'Saved!' })"
        >success</IrisButton
      >
      <IrisButton size="sm" variant="outline" @click="toast.warning({ title: 'Heads up' })"
        >warning</IrisButton
      >
      <IrisButton
        size="sm"
        variant="outline"
        @click="toast.error({ title: 'Failed', description: 'Network error.' })"
        >error</IrisButton
      >
      <IrisButton
        size="sm"
        variant="ghost"
        @click="
          toast.push({
            title: 'Undo me?',
            action: { label: 'Undo', onClick: () => toast.success({ title: 'Undone' }) },
            duration: 6000,
          })
        "
      >
        with action
      </IrisButton>
    </div>

    <div class="row">
      <span class="row-label">command</span>
      <IrisButton variant="solid" @click="cmdOpen = true">
        Open palette <IrisKbd style="margin-left: 6px">⌘K</IrisKbd>
      </IrisButton>
      <IrisCommandPalette v-model:open="cmdOpen" :items="commands" />
    </div>
  </section>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: var(--iris-gap-md);
  flex-wrap: wrap;
}
.row + .row {
  margin-top: var(--iris-gap-md);
}
.row-label {
  width: 80px;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--iris-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>

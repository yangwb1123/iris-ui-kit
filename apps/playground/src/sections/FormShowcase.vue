<script setup lang="ts">
import { ref } from 'vue'
import {
  IrisButton,
  IrisCheckbox,
  IrisDialog,
  IrisDialogClose,
  IrisDialogContent,
  IrisDialogDescription,
  IrisDialogTitle,
  IrisDialogTrigger,
  IrisInput,
  IrisRadio,
  IrisRadioGroup,
  IrisSwitch,
  type IrisCheckboxValue,
} from '@iris-ui/vue'

const text = ref('Hello, Iris!')
const enabled = ref(false)
const accepted = ref<IrisCheckboxValue>(false)
const fruit = ref<string>('apple')
const dialogOpen = ref(false)
</script>

<template>
  <section class="section">
    <h2 class="section-title">Form Inputs &amp; Dialog</h2>

    <div class="row">
      <span class="row-label">input</span>
      <IrisInput v-model="text" placeholder="Type something" />
      <span style="font-size:12px;color:var(--iris-muted)">{{ text }}</span>
    </div>

    <div class="row">
      <span class="row-label">switch</span>
      <IrisSwitch v-model="enabled" />
      <span style="font-size:12px;color:var(--iris-muted)">{{ enabled ? 'on' : 'off' }}</span>
    </div>

    <div class="row">
      <span class="row-label">checkbox</span>
      <IrisCheckbox v-model="accepted">I agree to the terms</IrisCheckbox>
      <IrisButton
        size="sm"
        variant="ghost"
        @click="accepted = accepted === 'indeterminate' ? false : 'indeterminate'"
      >
        toggle indeterminate
      </IrisButton>
    </div>

    <div class="row">
      <span class="row-label">radio</span>
      <IrisRadioGroup v-model="fruit" style="flex-direction: row; gap: var(--iris-gap-md)">
        <IrisRadio value="apple">Apple</IrisRadio>
        <IrisRadio value="banana">Banana</IrisRadio>
        <IrisRadio value="cherry">Cherry</IrisRadio>
      </IrisRadioGroup>
      <span style="font-size:12px;color:var(--iris-muted)">→ {{ fruit }}</span>
    </div>

    <div class="row">
      <span class="row-label">dialog</span>
      <IrisDialog v-model:open="dialogOpen">
        <IrisDialogTrigger as-child>
          <IrisButton variant="outline">Open dialog</IrisButton>
        </IrisDialogTrigger>
        <IrisDialogContent>
          <IrisDialogTitle>Confirm action</IrisDialogTitle>
          <IrisDialogDescription>
            This is a modal with focus trap, body scroll lock, and Escape/backdrop dismiss.
          </IrisDialogDescription>
          <div style="display:flex; gap:var(--iris-gap-md); justify-content:flex-end">
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
  </section>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: var(--iris-gap-md);
  flex-wrap: wrap;
}
.row-label {
  width: 72px;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--iris-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>

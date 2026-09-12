<script setup lang="ts">
import { ref } from 'vue'
import {
  IrisButton,
  IrisCheckbox,
  IrisCombobox,
  IrisDialog,
  IrisDialogClose,
  IrisDialogContent,
  IrisDialogDescription,
  IrisDialogTitle,
  IrisDialogTrigger,
  IrisFormField,
  IrisInput,
  IrisOtpInput,
  IrisRadio,
  IrisRadioGroup,
  IrisSwitch,
  type IrisCheckboxValue,
  type IrisComboboxOption,
} from '@iris-ui-kit/vue'

const text = ref('Hello, Iris!')
const enabled = ref(false)
const accepted = ref<IrisCheckboxValue>(false)
const fruit = ref<string>('apple')
const otpCode = ref('')
const otpCompletedCode = ref<string | null>(null)
const recordOtpCompletion = (value: string) => {
  otpCompletedCode.value = value
}
const comboboxFruit = ref('apple')
const lastCommit = ref<string | null>(null)
const comboboxOptions: IrisComboboxOption[] = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
  { label: 'Durian', value: 'durian', disabled: true },
]
const updateComboboxFruit = (value: string) => {
  comboboxFruit.value = value
}
const recordFruitCommit = (value: string) => {
  lastCommit.value = value
}
const dialogOpen = ref(false)
</script>

<template>
  <section class="section">
    <h2 class="section-title">Form Inputs &amp; Dialog</h2>

    <div class="row">
      <span class="row-label">input</span>
      <IrisInput v-model="text" placeholder="Type something" />
      <span style="font-size: 12px; color: var(--iris-muted)">{{ text }}</span>
    </div>

    <div class="row">
      <span class="row-label">switch</span>
      <IrisSwitch v-model="enabled" />
      <span style="font-size: 12px; color: var(--iris-muted)">{{ enabled ? 'on' : 'off' }}</span>
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
      <span style="font-size: 12px; color: var(--iris-muted)">→ {{ fruit }}</span>
    </div>

    <div class="otp-scenario">
      <h3 class="scenario-title">IrisOtpInput verification code</h3>
      <p class="scenario-description">
        Enter four numeric characters. Pasting distributes them across the cells, removes
        non-numeric characters, and reports completion when the final cell is filled.
      </p>

      <div class="otp-examples">
        <div class="otp-example">
          <IrisFormField label="Verification code" hint="Paste a code or enter each digit.">
            <IrisOtpInput
              v-model="otpCode"
              :length="4"
              type="numeric"
              mask
              data-testid="otp-input"
              @complete="recordOtpCompletion"
            />
          </IrisFormField>
          <div class="otp-readouts">
            <p class="otp-readout">
              <span class="readout-label">Current value:</span>
              <span data-testid="otp-value-readout" role="status" aria-live="polite">{{
                otpCode || '(empty)'
              }}</span>
            </p>
            <p class="otp-readout">
              <span class="readout-label">Completion:</span>
              <span data-testid="otp-completion-status" role="status" aria-live="polite">{{
                otpCompletedCode ?? '(not complete)'
              }}</span>
            </p>
          </div>
        </div>

        <div class="otp-example">
          <IrisFormField label="Invalid code" error="Enter all four digits.">
            <IrisOtpInput
              model-value="12"
              :length="4"
              type="numeric"
              invalid
              data-testid="otp-invalid-input"
            />
          </IrisFormField>
        </div>

        <div class="otp-example">
          <IrisFormField
            label="Disabled code"
            hint="This example is populated but cannot be edited."
          >
            <IrisOtpInput
              model-value="4821"
              :length="4"
              type="numeric"
              disabled
              data-testid="otp-disabled-input"
            />
          </IrisFormField>
        </div>
      </div>
    </div>

    <div class="combobox-scenario">
      <h3 class="scenario-title">IrisCombobox searchable selection and free-text commit</h3>
      <p class="scenario-description">
        Search the fruit list, select a controlled value, or commit a custom fruit name. Durian is
        disabled to make option-level behavior visible.
      </p>

      <div class="row">
        <span class="row-label">combobox</span>
        <div class="combobox-control">
          <IrisCombobox
            id="fruit-combobox"
            :model-value="comboboxFruit"
            :options="comboboxOptions"
            placeholder="Search fruit"
            allow-commit
            empty-text="No fruit matches"
            @update:model-value="updateComboboxFruit"
            @commit="recordFruitCommit"
          />
          <div class="combobox-readouts">
            <p data-testid="combobox-selected-readout" role="status" aria-live="polite">
              <span class="readout-label">Selected:</span> {{ comboboxFruit }}
            </p>
            <p data-testid="combobox-commit-readout" role="status" aria-live="polite">
              <span class="readout-label">Last commit:</span> {{ lastCommit ?? '(none)' }}
            </p>
          </div>
        </div>
      </div>

      <div class="row">
        <span class="row-label">invalid</span>
        <IrisCombobox
          id="fruit-combobox-invalid"
          :options="comboboxOptions"
          placeholder="Invalid fruit"
          invalid
        />
      </div>
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
.otp-scenario {
  display: flex;
  flex-direction: column;
  gap: var(--iris-gap-md);
  margin-block-start: var(--iris-space-lg, 16px);
  padding-block-start: var(--iris-space-lg, 16px);
  border-block-start: 1px solid var(--iris-border);
}
.otp-examples {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--iris-gap-lg, var(--iris-gap-md));
}
.otp-example {
  display: flex;
  min-width: 220px;
  flex: 1 1 220px;
  flex-direction: column;
  gap: var(--iris-gap-sm);
}
.otp-readouts {
  display: flex;
  flex-direction: column;
  gap: var(--iris-gap-sm);
  color: var(--iris-muted);
  font-size: var(--iris-font-size-xs, 12px);
}
.otp-readout {
  display: flex;
  gap: var(--iris-gap-sm);
  margin: 0;
}
.combobox-scenario {
  display: flex;
  flex-direction: column;
  gap: var(--iris-gap-md);
  margin-block-start: var(--iris-space-lg, 16px);
  padding-block-start: var(--iris-space-lg, 16px);
  border-block-start: 1px solid var(--iris-border);
}
.scenario-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.scenario-description {
  max-width: 720px;
  margin: 0;
  color: var(--iris-muted);
  font-size: 13px;
}
.combobox-control {
  display: flex;
  align-items: center;
  gap: var(--iris-gap-md);
  min-width: 0;
  flex: 1 1 320px;
  flex-wrap: wrap;
}
.combobox-readouts {
  display: flex;
  flex-direction: column;
  gap: var(--iris-gap-sm);
  min-width: 180px;
  color: var(--iris-muted);
  font-size: 12px;
}
.combobox-readouts p {
  margin: 0;
}
.readout-label {
  color: var(--iris-foreground);
  font-weight: 600;
}
</style>

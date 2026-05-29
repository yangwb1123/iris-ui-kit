<script setup lang="ts">
import { ref } from 'vue'
import {
  IrisTabs,
  IrisTabsList,
  IrisTabsTrigger,
  IrisTabsContent,
  IrisAccordion,
  IrisAccordionItem,
  IrisStepper,
  IrisStepperStep,
  IrisToggleGroup,
  IrisToggleGroupItem,
  IrisPagination,
  IrisBreadcrumb,
  IrisBreadcrumbItem,
  IrisButton,
} from '@iris-ui/vue'

const activeTab = ref('overview')
const openSections = ref<string[]>(['intro'])
const stepIndex = ref(0)
const textAlign = ref<string | null>('left')
const toolbarValues = ref<string[]>(['bold'])
const page = ref(3)
</script>

<template>
  <section class="section">
    <h2 class="section-title">Composite Components</h2>

    <div class="row" style="flex-direction: column; align-items: stretch">
      <span class="row-label">tabs</span>
      <IrisTabs v-model:value="activeTab">
        <IrisTabsList>
          <IrisTabsTrigger value="overview">Overview</IrisTabsTrigger>
          <IrisTabsTrigger value="usage">Usage</IrisTabsTrigger>
          <IrisTabsTrigger value="api" disabled>API (disabled)</IrisTabsTrigger>
          <IrisTabsTrigger value="changelog">Changelog</IrisTabsTrigger>
        </IrisTabsList>
        <IrisTabsContent value="overview">
          <p style="margin: 12px 0; color: var(--iris-muted)">
            Overview panel. Roving tabindex + arrow-key nav built in.
          </p>
        </IrisTabsContent>
        <IrisTabsContent value="usage">
          <p style="margin: 12px 0; color: var(--iris-muted)">
            Usage panel. Lazy-mounts by default (this content was unmounted until now).
          </p>
        </IrisTabsContent>
        <IrisTabsContent value="changelog">
          <p style="margin: 12px 0; color: var(--iris-muted)">Changelog panel.</p>
        </IrisTabsContent>
      </IrisTabs>
    </div>

    <div class="row" style="flex-direction: column; align-items: stretch">
      <span class="row-label">accordion</span>
      <IrisAccordion v-model="openSections" multiple>
        <IrisAccordionItem value="intro" title="What is Iris UI?">
          A token-driven component library with separated state/UI/theme.
        </IrisAccordionItem>
        <IrisAccordionItem value="why" title="Why a 5-layer architecture?">
          Each layer has a single responsibility — easy to swap or compose.
        </IrisAccordionItem>
        <IrisAccordionItem value="status" title="Production-ready?">
          Vue + React adapters are at parity; 1300+ tests pass on every commit.
        </IrisAccordionItem>
      </IrisAccordion>
    </div>

    <div class="row" style="flex-direction: column; align-items: stretch">
      <span class="row-label">stepper</span>
      <IrisStepper v-model="stepIndex">
        <IrisStepperStep title="Account" />
        <IrisStepperStep title="Profile" />
        <IrisStepperStep title="Preferences" />
        <IrisStepperStep title="Review" />
      </IrisStepper>
      <div style="display: flex; gap: 8px; margin-top: 8px">
        <IrisButton
          size="sm"
          variant="ghost"
          :disabled="stepIndex === 0"
          @click="stepIndex = Math.max(0, stepIndex - 1)"
        >
          Back
        </IrisButton>
        <IrisButton
          size="sm"
          variant="solid"
          :disabled="stepIndex === 3"
          @click="stepIndex = Math.min(3, stepIndex + 1)"
        >
          Next
        </IrisButton>
      </div>
    </div>

    <div class="row" style="flex-direction: column; align-items: stretch">
      <span class="row-label">toggle-group</span>
      <div>
        <p style="margin: 0 0 6px 0; font-size: 12px; color: var(--iris-muted)">
          single (radio-like) — text align
        </p>
        <IrisToggleGroup
          type="single"
          :modelValue="textAlign"
          @update:modelValue="textAlign = $event as string | null"
        >
          <IrisToggleGroupItem value="left">Left</IrisToggleGroupItem>
          <IrisToggleGroupItem value="center">Center</IrisToggleGroupItem>
          <IrisToggleGroupItem value="right">Right</IrisToggleGroupItem>
        </IrisToggleGroup>
      </div>
      <div>
        <p style="margin: 8px 0 6px 0; font-size: 12px; color: var(--iris-muted)">
          multiple (toggle-like) — text style
        </p>
        <IrisToggleGroup
          type="multiple"
          :modelValue="toolbarValues"
          @update:modelValue="toolbarValues = $event as string[]"
        >
          <IrisToggleGroupItem value="bold">B</IrisToggleGroupItem>
          <IrisToggleGroupItem value="italic">I</IrisToggleGroupItem>
          <IrisToggleGroupItem value="underline">U</IrisToggleGroupItem>
        </IrisToggleGroup>
      </div>
    </div>

    <div class="row" style="flex-direction: column; align-items: stretch">
      <span class="row-label">pagination</span>
      <IrisPagination v-model="page" :total="200" :page-size="10" show-first-last />
      <span style="font-size: 12px; color: var(--iris-muted)">page → {{ page }}</span>
    </div>

    <div class="row">
      <span class="row-label">breadcrumb</span>
      <IrisBreadcrumb>
        <IrisBreadcrumbItem href="/">Home</IrisBreadcrumbItem>
        <IrisBreadcrumbItem href="/docs">Docs</IrisBreadcrumbItem>
        <IrisBreadcrumbItem href="/docs/primitives">Primitives</IrisBreadcrumbItem>
        <IrisBreadcrumbItem>Breadcrumb</IrisBreadcrumbItem>
      </IrisBreadcrumb>
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
  width: 100px;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--iris-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>

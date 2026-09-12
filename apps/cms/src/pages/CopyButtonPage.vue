<script setup lang="ts">
import { ref } from 'vue'
import { IrisCopyButton } from '@iris-ui-kit/vue'

const lastCopiedText = ref<string | null>(null)

function handleCopy(text: string): void {
  lastCopiedText.value = text
}
</script>

<template>
  <section data-page="copy-button">
    <h1 class="page-title">Copy Button</h1>
    <p class="page-desc">
      Copy a fixed sample value and observe the component's emitted <code>copy</code> payload. The
      readout uses that event directly and does not inspect the system clipboard.
    </p>

    <div style="display: grid; gap: var(--iris-space-md, 16px); max-width: 720px">
      <section
        aria-labelledby="copy-active-heading"
        style="
          display: grid;
          gap: var(--iris-space-xs, 8px);
          padding: var(--iris-space-md, 16px);
          border: 1px solid var(--iris-border);
          border-radius: var(--iris-radius-md, 6px);
          background: var(--iris-surface);
        "
      >
        <h2 id="copy-active-heading" style="margin: 0; font-size: var(--iris-font-size-lg, 16px)">
          Active copy
        </h2>
        <p style="margin: 0; color: var(--iris-muted); font-size: var(--iris-font-size-sm, 13px)">
          Copies <code>Iris CMS copy-button sample</code> and reports the emitted text below. The
          copied label lasts 300ms, then the button returns to its idle label.
        </p>
        <IrisCopyButton
          data-testid="copy-active-button"
          text="Iris CMS copy-button sample"
          copied-label="Copied!"
          :timeout="300"
          style="justify-self: start"
          @copy="handleCopy"
        >
          Copy sample
        </IrisCopyButton>
      </section>

      <section
        aria-labelledby="copy-disabled-heading"
        style="
          display: grid;
          gap: var(--iris-space-xs, 8px);
          padding: var(--iris-space-md, 16px);
          border: 1px solid var(--iris-border);
          border-radius: var(--iris-radius-md, 6px);
          background: var(--iris-surface);
        "
      >
        <h2 id="copy-disabled-heading" style="margin: 0; font-size: var(--iris-font-size-lg, 16px)">
          Disabled copy
        </h2>
        <p style="margin: 0; color: var(--iris-muted); font-size: var(--iris-font-size-sm, 13px)">
          The fixed value is <code>Iris CMS disabled copy-button sample</code>. This example stays
          disabled and ignores activation without changing the readout.
        </p>
        <IrisCopyButton
          data-testid="copy-disabled-button"
          text="Iris CMS disabled copy-button sample"
          disabled
          style="justify-self: start"
        >
          Copy disabled sample
        </IrisCopyButton>
      </section>

      <div
        data-testid="copy-event-readout"
        role="status"
        aria-live="polite"
        style="
          padding: var(--iris-space-md, 16px);
          border: 1px solid var(--iris-border);
          border-radius: var(--iris-radius-md, 6px);
          background: var(--iris-surface);
        "
      >
        Last copied text: {{ lastCopiedText ?? 'none' }}
      </div>
    </div>
  </section>
</template>

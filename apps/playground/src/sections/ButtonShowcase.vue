<script setup lang="ts">
import { ref } from 'vue'
import { IrisButton, type IrisButtonSize, type IrisButtonVariant } from '@iris-ui/vue'

const VARIANTS: IrisButtonVariant[] = ['solid', 'outline', 'ghost', 'link']
const SIZES: IrisButtonSize[] = ['sm', 'md', 'lg']

const clickCount = ref(0)
const asyncLoading = ref(false)

function fakeAsync() {
  asyncLoading.value = true
  setTimeout(() => {
    asyncLoading.value = false
    clickCount.value += 1
  }, 1500)
}
</script>

<template>
  <section class="section">
    <div class="title-block">
      <h2 class="section-title">Button</h2>
      <span class="counter">Click count: {{ clickCount }}</span>
    </div>

    <div v-for="variant in VARIANTS" :key="variant" class="row">
      <span class="row-label">{{ variant }}</span>
      <IrisButton
        v-for="size in SIZES"
        :key="size"
        :variant="variant"
        :size="size"
        @click="clickCount += 1"
      >
        {{ size }}
      </IrisButton>
      <IrisButton :variant="variant" disabled @click="clickCount += 1"> disabled </IrisButton>
      <IrisButton :variant="variant" :loading="asyncLoading" @click="fakeAsync">
        <template #leading>
          <span class="lead-dot" aria-hidden="true" />
        </template>
        async 1.5s
      </IrisButton>
    </div>

    <div class="row">
      <span class="row-label">as-child</span>
      <IrisButton as-child variant="outline" size="md">
        <a href="#anchor-demo" @click.prevent="clickCount += 1"> rendered as &lt;a href&gt; </a>
      </IrisButton>
      <IrisButton as-child variant="link" size="md">
        <a
          href="https://example.com"
          target="_blank"
          rel="noopener"
          @click.prevent="clickCount += 1"
        >
          external link
        </a>
      </IrisButton>
    </div>
  </section>
</template>

<style scoped>
.title-block {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--iris-gap-md);
}

.counter {
  font-size: 12px;
  color: var(--iris-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}

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

.lead-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  display: inline-block;
}
</style>

<template>
  <header style="margin-bottom: 28px">
    <IrisBadge tone="warning" variant="solid">Nuxt server API</IrisBadge>
    <h1 style="margin: 12px 0 6px; font-size: 28px">Feedback</h1>
    <p style="margin: 0; color: var(--iris-muted-foreground)">
      The same form works as a native POST without JavaScript and gains pending feedback after
      hydration.
    </p>
  </header>

  <form
    action="/api/feedback"
    method="post"
    style="display: grid; gap: 18px; max-width: 620px"
    @submit.prevent="submitFeedback"
  >
    <div style="display: grid; gap: 6px">
      <label for="feedback-name" style="font-weight: 600">Name</label>
      <input
        id="feedback-name"
        v-model="name"
        name="name"
        autocomplete="name"
        :aria-invalid="fieldErrors.name ? 'true' : undefined"
        :aria-describedby="fieldErrors.name ? 'feedback-name-error' : undefined"
        style="
          min-height: 38px;
          padding: 6px var(--iris-padding-md);
          border: 1px solid var(--iris-border);
          border-radius: var(--iris-radius-md);
          background: var(--iris-background);
          color: var(--iris-foreground);
          font: inherit;
        "
      />
      <span
        v-if="fieldErrors.name"
        id="feedback-name-error"
        style="color: var(--iris-danger); font-size: 13px"
      >
        {{ fieldErrors.name }}
      </span>
    </div>

    <div style="display: grid; gap: 6px">
      <label for="feedback-message" style="font-weight: 600">Message</label>
      <textarea
        id="feedback-message"
        v-model="message"
        name="message"
        rows="5"
        :aria-invalid="fieldErrors.message ? 'true' : undefined"
        :aria-describedby="fieldErrors.message ? 'feedback-message-error' : undefined"
        style="
          padding: var(--iris-padding-md);
          border: 1px solid var(--iris-border);
          border-radius: var(--iris-radius-md);
          background: var(--iris-background);
          color: var(--iris-foreground);
          font: inherit;
          resize: vertical;
        "
      />
      <span
        v-if="fieldErrors.message"
        id="feedback-message-error"
        style="color: var(--iris-danger); font-size: 13px"
      >
        {{ fieldErrors.message }}
      </span>
    </div>

    <div>
      <IrisButton type="submit" :loading="pending" :disabled="pending">
        {{ pending ? 'Sending feedback…' : 'Send feedback' }}
      </IrisButton>
    </div>

    <IrisAlert v-if="result?.ok" tone="success" title="Feedback received" aria-live="polite">
      {{ result.message }}
    </IrisAlert>
    <IrisAlert
      v-else-if="result && !result.ok"
      tone="danger"
      title="Please check the form"
      aria-live="assertive"
    >
      {{ result.message }}
    </IrisAlert>
    <p v-else-if="pending" role="status" aria-live="polite" style="margin: 0">
      Sending your feedback…
    </p>
  </form>
</template>

<script setup lang="ts">
import { useRoute } from '#app'
import { computed, ref } from 'vue'
import { IrisAlert, IrisBadge, IrisButton } from '@iris-ui-kit/vue'

interface FeedbackResult {
  ok: boolean
  message: string
  errors?: Record<string, string>
}

const route = useRoute()
const name = ref('')
const message = ref('')
const pending = ref(false)
const result = ref<FeedbackResult | null>(
  route.query.status === 'success'
    ? { ok: true, message: 'Thanks — your feedback was validated on the server.' }
    : route.query.status === 'error'
      ? { ok: false, message: String(route.query.message ?? 'Please check the form.') }
      : null,
)
const fieldErrors = computed(() => result.value?.errors ?? {})

async function submitFeedback() {
  pending.value = true
  result.value = null

  const body = new FormData()
  body.set('name', name.value)
  body.set('message', message.value)

  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      body,
      headers: { accept: 'application/json' },
    })
    const feedback = (await response.json()) as FeedbackResult
    result.value = feedback
    if (feedback.ok) message.value = ''
  } catch (error) {
    result.value =
      (error as { data?: FeedbackResult }).data ??
      ({ ok: false, message: 'The server could not accept the feedback.' } satisfies FeedbackResult)
  } finally {
    pending.value = false
  }
}
</script>

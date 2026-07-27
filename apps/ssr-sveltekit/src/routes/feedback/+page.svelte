<script lang="ts">
  import { enhance } from '$app/forms'
  import { IrisBadge, IrisButton, IrisInput } from '@iris-ui-kit/svelte'
  import type { ActionData } from './$types'

  let { form }: { form: ActionData } = $props()
  let pending = $state(false)
</script>

<header style="margin-bottom:28px">
  <IrisBadge tone="warning" variant="solid">SvelteKit form action</IrisBadge>
  <h1 style="margin:12px 0 6px;font-size:28px">Feedback</h1>
  <p style="margin:0;color:var(--iris-muted-foreground)">
    The form posts through a native SvelteKit server action and progressively enhances after
    hydration.
  </p>
</header>

<form
  method="post"
  style="display:grid;gap:18px;max-width:620px"
  use:enhance={() => {
    pending = true
    return async ({ update }) => {
      try {
        await update()
      } finally {
        pending = false
      }
    }
  }}
>
  <div style="display:grid;gap:6px">
    <label for="feedback-name" style="font-weight:600">Name</label>
    <IrisInput
      id="feedback-name"
      name="name"
      autocomplete="name"
      value={form?.values?.name ?? ''}
      invalid={Boolean(form?.errors?.name)}
      ariaDescribedby={form?.errors?.name ? 'feedback-name-error' : undefined}
      style="width:100%"
    />
    {#if form?.errors?.name}
      <span id="feedback-name-error" style="color:var(--iris-danger);font-size:13px">
        {form.errors.name}
      </span>
    {/if}
  </div>

  <div style="display:grid;gap:6px">
    <label for="feedback-message" style="font-weight:600">Message</label>
    <textarea
      id="feedback-message"
      name="message"
      rows="5"
      value={form?.values?.message ?? ''}
      aria-invalid={form?.errors?.message ? 'true' : undefined}
      aria-describedby={form?.errors?.message ? 'feedback-message-error' : undefined}
      style="padding:var(--iris-padding-md);border:1px solid var(--iris-border);border-radius:var(--iris-radius-md);background:var(--iris-background);color:var(--iris-foreground);font:inherit;resize:vertical"
    ></textarea>
    {#if form?.errors?.message}
      <span id="feedback-message-error" style="color:var(--iris-danger);font-size:13px">
        {form.errors.message}
      </span>
    {/if}
  </div>

  <div>
    <IrisButton type="submit" loading={pending} disabled={pending}>
      {pending ? 'Sending feedback…' : 'Send feedback'}
    </IrisButton>
  </div>

  {#if pending}
    <p role="status" aria-live="polite" style="margin:0">Sending your feedback…</p>
  {:else if form?.success}
    <div
      role="status"
      aria-live="polite"
      data-feedback-state="success"
      style="padding:var(--iris-padding-md);border:1px solid var(--iris-success);border-radius:var(--iris-radius-md);color:var(--iris-foreground);background:var(--iris-background)"
    >
      <strong style="color:var(--iris-success)">Feedback received</strong>
      <div>{form.message}</div>
    </div>
  {:else if form && !form.success}
    <div
      role="alert"
      aria-live="assertive"
      data-feedback-state="error"
      style="padding:var(--iris-padding-md);border:1px solid var(--iris-danger);border-radius:var(--iris-radius-md);color:var(--iris-foreground);background:var(--iris-background)"
    >
      <strong style="color:var(--iris-danger)">Please check the form</strong>
      <div>{form.message}</div>
    </div>
  {/if}
</form>

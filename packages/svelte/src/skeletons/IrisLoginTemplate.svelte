<script lang="ts">
  import type { Snippet } from 'svelte'
  import IrisContainer from '../layouts/IrisContainer.svelte'

  export interface IrisLoginSubmitPayload {
    email: string
    password: string
    remember: boolean
  }

  interface Props {
    title?: string
    description?: string
    showRemember?: boolean
    error?: string
    submitLabel?: string
    loading?: boolean
    onSubmit?: (payload: IrisLoginSubmitPayload) => void
    children?: Snippet
    style?: string
    class?: string
  }

  let {
    title = 'Sign in',
    description = '',
    showRemember = true,
    error = '',
    submitLabel = 'Sign in',
    loading = false,
    onSubmit,
    children,
    style,
    class: className,
    ...rest
  }: Props = $props()

  let email = $state('')
  let password = $state('')
  let remember = $state(false)

  function handleSubmit(e: Event) {
    e.preventDefault()
    onSubmit?.({ email, password, remember })
  }
</script>

<div
  data-iris-login-template
  style:display="flex"
  style:align-items="center"
  style:justify-content="center"
  style:min-height="100vh"
  style:background="var(--iris-background)"
  {style}
  class={className}
  {...rest}
>
  <IrisContainer maxWidth="sm" padding="md">
    <div
      style:background="var(--iris-surface)"
      style:border="1px solid var(--iris-border)"
      style:border-radius="var(--iris-radius-lg, 8px)"
      style:padding="32px"
      style:width="100%"
    >
      <!-- Title -->
      <h1
        style:margin="0 0 8px"
        style:font-size="24px"
        style:font-weight="700"
        style:color="var(--iris-foreground)"
      >
        {title}
      </h1>
      {#if description}
        <p style:margin="0 0 24px" style:font-size="14px" style:color="var(--iris-muted)">
          {description}
        </p>
      {:else}
        <div style:margin-bottom="24px"></div>
      {/if}

      <!-- Error -->
      {#if error}
        <div
          data-iris-login-error
          role="alert"
          style:padding="10px 14px"
          style:margin-bottom="16px"
          style:background="color-mix(in srgb, var(--iris-danger) 12%, transparent)"
          style:color="var(--iris-danger)"
          style:border-radius="var(--iris-radius-sm, 4px)"
          style:font-size="14px"
        >
          {error}
        </div>
      {/if}

      <form onsubmit={handleSubmit} data-iris-login-form>
        <!-- Email -->
        <div style:margin-bottom="16px">
          <label
            for="iris-login-email"
            style:display="block"
            style:font-size="14px"
            style:font-weight="500"
            style:margin-bottom="6px"
            style:color="var(--iris-foreground)">Email</label
          >
          <input
            id="iris-login-email"
            type="email"
            bind:value={email}
            name="email"
            autocomplete="email"
            disabled={loading}
            required
            style:width="100%"
            style:box-sizing="border-box"
            style:padding="8px 12px"
            style:border="1px solid var(--iris-border)"
            style:border-radius="var(--iris-radius-md, 6px)"
            style:font-size="14px"
            style:font-family="inherit"
            style:background="var(--iris-background)"
            style:color="var(--iris-foreground)"
            style:outline="none"
          />
        </div>

        <!-- Password -->
        <div style:margin-bottom={showRemember ? '16px' : '24px'}>
          <label
            for="iris-login-password"
            style:display="block"
            style:font-size="14px"
            style:font-weight="500"
            style:margin-bottom="6px"
            style:color="var(--iris-foreground)">Password</label
          >
          <input
            id="iris-login-password"
            type="password"
            bind:value={password}
            name="password"
            autocomplete="current-password"
            disabled={loading}
            required
            style:width="100%"
            style:box-sizing="border-box"
            style:padding="8px 12px"
            style:border="1px solid var(--iris-border)"
            style:border-radius="var(--iris-radius-md, 6px)"
            style:font-size="14px"
            style:font-family="inherit"
            style:background="var(--iris-background)"
            style:color="var(--iris-foreground)"
            style:outline="none"
          />
        </div>

        <!-- Remember me -->
        {#if showRemember}
          <div
            style:display="flex"
            style:align-items="center"
            style:gap="8px"
            style:margin-bottom="24px"
          >
            <input
              id="iris-login-remember"
              type="checkbox"
              bind:checked={remember}
              disabled={loading}
            />
            <label
              for="iris-login-remember"
              style:font-size="14px"
              style:color="var(--iris-foreground)">Remember me</label
            >
          </div>
        {/if}

        <!-- Submit -->
        <button
          type="submit"
          data-iris-login-submit
          disabled={loading}
          style:width="100%"
          style:padding="10px 16px"
          style:background="var(--iris-primary)"
          style:color="var(--iris-primary-foreground, #fff)"
          style:border="none"
          style:border-radius="var(--iris-radius-md, 6px)"
          style:font-size="14px"
          style:font-weight="600"
          style:font-family="inherit"
          style:cursor={loading ? 'not-allowed' : 'pointer'}
          style:opacity={loading ? '0.7' : '1'}>{loading ? 'Signing in…' : submitLabel}</button
        >
      </form>

      {#if children}
        <div style:margin-top="16px">
          {@render children()}
        </div>
      {/if}
    </div>
  </IrisContainer>
</div>

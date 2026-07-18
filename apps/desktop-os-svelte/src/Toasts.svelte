<script lang="ts" module>
  import type { NotificationTone } from '@iris-ui/core/notifications'

  /** Accent glyph + color per tone (color via token-friendly literals). */
  const TONE: Record<NotificationTone, { glyph: string; color: string }> = {
    info: { glyph: 'ℹ️', color: 'var(--os-accent)' },
    success: { glyph: '✅', color: '#28c840' },
    warning: { glyph: '⚠️', color: '#febc2e' },
    danger: { glyph: '⛔', color: '#ff5f57' },
  }

  /** Newest notifications shown as transient toasts; the rest live in the center. */
  const MAX_TOASTS = 4
</script>

<script lang="ts">
  /**
   * The desktop TOAST stack — renders the newest notifications from the shared
   * {@link createNotificationCenter} in a corner, above windows. Each toast
   * auto-dismisses after its `timeout` (0 = sticky); ✕ dismisses now. Token-skinned
   * to the active OS — mirrors the React reference (apps/desktop-os/src/components/Toasts.tsx).
   */
  import type { DesktopNotification } from '@iris-ui/core/notifications'
  import { notifications, useNotificationState } from './notifications.svelte'

  const nstate = useNotificationState()
  const toasts = $derived(nstate.value.notifications.slice(0, MAX_TOASTS))

  // Per-toast auto-dismiss: an attachment arms a setTimeout for the lifetime of the
  // toast element and clears it on removal — the idiomatic Svelte 5 counterpart of
  // React's per-toast `useEffect` (the core engine stays timer-free, so the shell
  // owns the setTimeout). `n.timeout` 0 = sticky (center only, never auto-dismissed).
  function armDismiss(n: DesktopNotification) {
    return () => {
      if (!n.timeout) return
      const t = setTimeout(() => notifications.dismiss(n.id), n.timeout)
      return () => clearTimeout(t)
    }
  }
</script>

<!-- One toast — auto-dismisses after its `timeout` (0 = sticky); ✕ dismisses now. -->
{#snippet toast(n: DesktopNotification)}
  {@const tone = TONE[n.tone]}
  <div
    role="status"
    class="toast"
    style="border-left:3px solid {tone.color}"
    {@attach armDismiss(n)}
  >
    <span class="toast-glyph">{n.icon || tone.glyph}</span>
    <div class="toast-body">
      <div class="toast-title">{n.title}</div>
      {#if n.body}
        <div class="toast-text">{n.body}</div>
      {/if}
    </div>
    <button
      type="button"
      class="toast-close"
      aria-label="Dismiss notification"
      onclick={() => notifications.dismiss(n.id)}
    >
      ✕
    </button>
  </div>
{/snippet}

{#if toasts.length > 0}
  <div class="toasts" aria-live="polite">
    {#each toasts as n (n.id)}
      {@render toast(n)}
    {/each}
  </div>
{/if}

<style>
  .toasts {
    position: absolute;
    top: calc(var(--os-topbar-h, 0px) + 12px);
    right: 12px;
    z-index: 90000;
    display: grid;
    gap: 10px;
    pointer-events: auto;
  }
  .toast {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    width: 320px;
    padding: 10px 12px;
    border-radius: var(--os-window-radius);
    background: var(--os-window-bg);
    color: var(--os-window-fg);
    border: var(--os-window-border);
    box-shadow: var(--os-window-shadow);
    backdrop-filter: var(--os-blur);
    -webkit-backdrop-filter: var(--os-blur);
    font: 13px var(--os-font);
  }
  .toast-glyph {
    font-size: 16px;
    line-height: 18px;
  }
  .toast-body {
    flex: 1;
    min-width: 0;
  }
  .toast-title {
    font-weight: 600;
  }
  .toast-text {
    opacity: 0.75;
    margin-top: 2px;
    line-height: 1.4;
  }
  .toast-close {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.5;
    font-size: 14px;
    line-height: 14px;
    padding: 2px;
  }
</style>

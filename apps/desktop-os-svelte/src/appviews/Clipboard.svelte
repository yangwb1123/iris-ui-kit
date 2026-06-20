<script lang="ts">
  /**
   * Clipboard — a desktop CLIPBOARD MANAGER (Win+V / macOS clipboard-manager
   * feel) over `@iris-ui/core/clipboard-history`. Records copied text, lets you
   * re-copy a past clip (writes the real system clipboard), pin clips so they
   * survive Clear, and remove individual entries. This is what makes the
   * `clipboard` permission the app requests actually do something. Mirrors the
   * React reference (apps/desktop-os/src/appviews/Clipboard.tsx).
   */
  import { IrisButton } from '@iris-ui/svelte'
  import { clipboard, useClipboardState } from '../clipboard.svelte'

  const cstate = useClipboardState()
  const entries = $derived(cstate.value.entries)

  let draft = $state('')

  /** Write to the real system clipboard (best-effort; demo tolerates failure). */
  async function writeSystemClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(text)
    } catch {
      /* clipboard API unavailable / denied — history still records it */
    }
  }

  async function copy(text: string): Promise<void> {
    await writeSystemClipboard(text)
    clipboard.add(text) // move-to-front / record
  }

  async function submit(e: SubmitEvent): Promise<void> {
    e.preventDefault()
    const t = draft.trim()
    if (!t) return
    draft = ''
    await copy(t)
  }
</script>

<div class="clip">
  <header class="hdr">
    <div class="title">📋 Clipboard history ({entries.length})</div>
    <div class="lede">Recent clips. Click one to copy it again; ★ pins it (survives Clear).</div>
  </header>

  <div class="list">
    {#each entries as e (e.id)}
      <div class="row">
        <button
          type="button"
          class="clip-text"
          title="Copy again"
          onclick={() => void copy(e.text)}
        >
          {e.text}
        </button>
        <button
          type="button"
          class="icon-btn pin{e.pinned ? ' pin--on' : ''}"
          aria-label={e.pinned ? 'Unpin' : 'Pin'}
          aria-pressed={e.pinned}
          onclick={() => clipboard.togglePin(e.id)}
        >
          ★
        </button>
        <button
          type="button"
          class="icon-btn"
          aria-label="Remove"
          onclick={() => clipboard.remove(e.id)}
        >
          ✕
        </button>
      </div>
    {/each}
    {#if entries.length === 0}
      <div class="empty">Nothing copied yet — type below and Copy, or copy from another app.</div>
    {/if}
  </div>

  <form class="composer" onsubmit={submit}>
    <input class="input" bind:value={draft} placeholder="Text to copy…" aria-label="Text to copy" />
    <IrisButton type="submit" variant="solid">Copy</IrisButton>
    <IrisButton type="button" variant="outline" onclick={() => clipboard.clear()}>Clear</IrisButton>
  </form>
</div>

<style>
  .clip {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .hdr {
    padding: 16px;
    border-bottom: 1px solid rgba(127, 127, 127, 0.2);
  }
  .title {
    font-weight: 600;
    font-size: 14px;
  }
  .lede {
    font-size: 12px;
    opacity: 0.7;
    margin-top: 4px;
    line-height: 1.5;
  }
  .list {
    flex: 1;
    overflow: auto;
    padding: 16px;
    display: grid;
    gap: 8px;
    align-content: start;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(127, 127, 127, 0.1);
  }
  .clip-text {
    flex: 1;
    min-width: 0;
    text-align: left;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: 13px var(--os-font);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .icon-btn {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 13px;
    opacity: 0.5;
  }
  .pin {
    opacity: 0.4;
  }
  .pin--on {
    opacity: 1;
    color: var(--os-accent);
  }
  .empty {
    font-size: 13px;
    opacity: 0.6;
  }
  .composer {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid rgba(127, 127, 127, 0.2);
  }
  .input {
    flex: 1;
    padding: 9px 14px;
    border-radius: 999px;
    border: 1px solid rgba(127, 127, 127, 0.35);
    background: rgba(255, 255, 255, 0.5);
    color: inherit;
    outline: none;
    font-size: 14px;
  }
</style>

<script lang="ts">
  // Per-window state: each Notepad window keeps its own text.
  let text = $state('')
</script>

<textarea
  bind:value={text}
  placeholder="Type something… (state lives in this window)"
  class="notepad"
></textarea>

<style>
  .notepad {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border: none;
    outline: none;
    resize: none;
    padding: 16px;
    font: 14px/1.6 ui-monospace, monospace;
    background: transparent;
    color: var(--os-window-fg);
  }
</style>

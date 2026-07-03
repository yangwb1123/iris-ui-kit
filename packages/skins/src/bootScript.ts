export interface SkinBootScriptConfig {
  storageKey?: string
  /** Pre-serialized CSS per skin id (from `renderSkinStyle` with `':root'`). */
  styles: Record<string, string>
  /** Fallback skin id when storage is empty / unknown. */
  fallbackId: string
  /** Map system light/dark → skin id when the stored value is `'system'`. */
  systemMap?: { light: string; dark: string }
  /**
   * CSP nonce value. When the page uses a Content-Security-Policy with
   * `style-src: 'nonce-...'`, inline `<style>` elements must carry a matching
   * `nonce` attribute. Pass the server-rendered nonce to prevent the boot
   * stylesheet from being blocked by the browser.
   */
  nonce?: string
}

/**
 * Build a self-contained inline `<script>` body (a string) the host injects in
 * `<head>` before first paint to eliminate FOUC / hydration flash. At runtime
 * it reads the persisted id (or system preference), looks up the pre-serialized
 * CSS, and appends a `<style>` via `textContent` (never innerHTML). Ships only
 * strings — no resolver logic — so it stays tiny.
 *
 * When `nonce` is provided, the injected `<style>` element carries a matching
 * `nonce` attribute so Content-Security-Policy with `style-src: 'nonce-...'`
 * does not block the boot stylesheet.
 */
export function skinBootScript(config: SkinBootScriptConfig): string {
  const payload = JSON.stringify({
    key: config.storageKey ?? 'iris-skin',
    styles: config.styles,
    fallbackId: config.fallbackId,
    systemMap: config.systemMap ?? null,
    nonce: config.nonce ?? null,
  })
  return (
    `(function(){var c=${payload};try{` +
    `var id=localStorage.getItem(c.key);` +
    `if((!id||id==='system')&&c.systemMap){` +
    `id=matchMedia('(prefers-color-scheme: dark)').matches?c.systemMap.dark:c.systemMap.light;}` +
    `if(!id||!c.styles[id])id=c.fallbackId;` +
    `var css=c.styles[id];if(!css)return;` +
    `var s=document.createElement('style');s.setAttribute('data-iris-skin-boot','');` +
    `if(c.nonce)s.setAttribute('nonce',c.nonce);` +
    `s.textContent=css;document.head.appendChild(s);` +
    `document.documentElement.setAttribute('data-iris-skin',id);}catch(e){}})();`
  )
}

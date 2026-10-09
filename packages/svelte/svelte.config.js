import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  // Erase script-only TypeScript in the publishable .svelte sources. Declarations
  // still come from svelte-package; markup and rune identifiers stay unchanged.
  preprocess: vitePreprocess({ script: true }),
}

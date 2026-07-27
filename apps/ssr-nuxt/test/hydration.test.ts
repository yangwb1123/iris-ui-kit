// App-level SSR + hydration test for the Nuxt 3 smoke app (ssr-nuxt).
//
// The package was previously "tested" by `echo "build IS the test" && exit 0`.
// A green `nuxi build` proves the routes *server-render*, but it does NOT catch
// the production failure mode that actually breaks SSR apps: a **hydration
// mismatch**, where the server HTML differs from the client's first render, so
// Vue tears down the SSR markup and re-renders from scratch (losing listeners,
// flashing the UI, logging warnings).
//
// This test performs the full SSR→hydrate cycle in jsdom on the app's *actual*
// iris-component composition:
//   1. server-render with `renderToString` from 'vue/server-renderer'
//      (createSSRApp → renderToString),
//   2. drop that HTML into a real container element,
//   3. hydrate by mounting a fresh SSR app onto the existing markup
//      (`createSSRApp(...).mount(container)` — Vue hydrates, it does not
//      replace, when it finds server markup),
//   4. assert Vue reported NO hydration mismatch AND the iris content survived.
//
// Why the composition is rebuilt here with render functions instead of importing
// `components/Demo.client.vue`:
//   • `Demo.client.vue` is a Nuxt *client island* (`.client` suffix) — it never
//     server-renders in the real app, and importing it would drag in Nuxt's
//     auto-import + SFC-compile machinery that this isolated vitest run does not
//     wire up (no `@vitejs/plugin-vue` in this workspace, and we add no deps).
//   • So we reproduce the SAME iris tree (ThemeProvider + Button + Input + Badge
//     + Dialog (closed) + Table) directly from `@iris-ui-kit/vue`, mirroring the
//     per-adapter reference test at `packages/vue/src/hydration.test.ts`.
//
// How Vue 3.5 signals a mismatch (per the bundled runtime): per-node
// `console.warn(...)` reports ("Hydration text mismatch in", "Hydration node
// mismatch", "Hydration attribute mismatch on", …) plus a one-shot
// `console.error("Hydration completed but contains mismatches.")`. We spy on
// both channels and assert neither fired a hydration-mismatch message.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, type VNode } from 'vue'
import { renderToString } from 'vue/server-renderer'

import {
  ThemeProvider,
  IrisButton,
  IrisInput,
  IrisBadge,
  IrisDialog,
  IrisDialogTrigger,
  IrisDialogContent,
  IrisDialogTitle,
  IrisDialogDescription,
  IrisDialogClose,
  IrisTable,
} from '@iris-ui-kit/vue'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'

// Same data shape as components/Demo.client.vue.
const rows: Record<string, unknown>[] = [
  { id: 1, name: 'Ada Lovelace', role: 'Engineer', status: 'active' },
  { id: 2, name: 'Alan Turing', role: 'Researcher', status: 'active' },
  { id: 3, name: 'Grace Hopper', role: 'Architect', status: 'away' },
]
const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'role', title: 'Role' },
  { key: 'status', title: 'Status' },
]

/**
 * Reproduce the iris composition rendered by `app.vue` → `Demo.client.vue`,
 * in its default (server-render) state: name empty, dialog closed. A fresh
 * `themeStore` per app instance keeps SSR and hydrate passes independent, the
 * way two processes (server, then browser) would each build their own.
 */
function buildApp(): VNode {
  const themeStore = createThemeStore({
    themes: { light: lightTheme, dark: darkTheme },
    default: 'light',
  })
  return h(
    ThemeProvider,
    { store: themeStore },
    {
      default: () =>
        h('section', { style: 'display: grid; gap: 24px' }, [
          // Basics: button + input + badge.
          h('div', { style: 'display: flex; align-items: center; gap: 12px; flex-wrap: wrap' }, [
            h(IrisButton, { variant: 'solid' }, { default: () => 'Primary action' }),
            h(IrisInput, { modelValue: '', placeholder: 'Type your name…' }),
            // name is '' on first render → 'live badge' (matches the SFC's v-if).
            h(IrisBadge, { tone: 'primary', variant: 'solid' }, { default: () => 'live badge' }),
          ]),

          // Overlay: Dialog, server-rendered CLOSED. In its closed state the
          // teleported content is not present, so there is nothing to hydrate
          // beyond the trigger — exactly the SSR shape the real app emits.
          h('div', { style: 'display: flex; gap: 12px; flex-wrap: wrap' }, [
            h(
              IrisDialog,
              { open: false },
              {
                default: () => [
                  h(
                    IrisDialogTrigger,
                    { asChild: true },
                    {
                      default: () =>
                        h(IrisButton, { variant: 'outline' }, { default: () => 'Open dialog' }),
                    },
                  ),
                  h(IrisDialogContent, null, {
                    default: () => [
                      h(IrisDialogTitle, null, { default: () => 'Hydrated overlay' }),
                      h(IrisDialogDescription, null, {
                        default: () =>
                          'This dialog was server-rendered closed and became interactive on hydration.',
                      }),
                      h(
                        IrisDialogClose,
                        { asChild: true },
                        {
                          default: () =>
                            h(IrisButton, { variant: 'solid' }, { default: () => 'Close' }),
                        },
                      ),
                    ],
                  }),
                ],
              },
            ),
          ]),

          // Data component: Table.
          h('div', null, [
            h('h2', { style: 'font-size: 16px; margin: 0 0 8px' }, 'Team'),
            h(IrisTable, { columns, data: rows, rowKey: 'id' }),
          ]),
        ]),
    },
  )
}

/** True if a console call looks like a Vue hydration-mismatch report. */
function isHydrationMismatch(args: unknown[]): boolean {
  return args.some((a) => typeof a === 'string' && /hydration/i.test(a) && /mismatch/i.test(a))
}

describe('ssr-nuxt app composition · SSR hydration', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Capture (and silence) Vue's mismatch reporting so we can assert on it.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('runs in a DOM (jsdom) environment', () => {
    expect(typeof document).toBe('object')
    expect(typeof window).toBe('object')
  })

  it("server markup of the app's iris composition hydrates without a mismatch", async () => {
    // 1. Server render → HTML string (the "Nuxt server response").
    const ssrHtml = await renderToString(createSSRApp({ render: buildApp }))
    expect(ssrHtml.length).toBeGreaterThan(0)
    // Sanity: the SSR HTML actually contains the iris composition's content.
    expect(ssrHtml).toContain('Primary action')
    expect(ssrHtml).toContain('Ada Lovelace')
    expect(ssrHtml).toContain('Team')

    // 2. Plant the server HTML into a real container, like a server response's
    //    `<div id="app">…</div>` arriving in the browser.
    const container = document.createElement('div')
    container.innerHTML = ssrHtml
    document.body.appendChild(container)

    // 3. Hydrate: a fresh SSR app mounts ONTO the existing markup. Vue walks
    //    the server DOM and adopts it in place — unless it finds a mismatch.
    const app = createSSRApp({ render: buildApp })
    try {
      app.mount(container)

      // 4a. No hydration-mismatch report from either console channel.
      const offending = [...errorSpy.mock.calls, ...warnSpy.mock.calls].filter(isHydrationMismatch)
      // Format defensively: Vue's mismatch warnings include non-string args
      // (vnodes, Symbols), so String()-map each arg rather than `.join`-ing raw.
      const offendingMsg = offending
        .map((call) => call.map((a) => (typeof a === 'string' ? a : String(a))).join(' '))
        .join('\n')
      expect(offending, `hydration mismatch:\n${offendingMsg}`).toHaveLength(0)

      // 4b. Sanity: hydration kept the iris content in the live DOM (a mismatch
      //     that rewrote the subtree, or a failed mount, would drop this).
      expect(container.textContent).toContain('Primary action')
      expect(container.textContent).toContain('Ada Lovelace')
      expect(container.textContent).toContain('Team')
      expect(container.querySelector('.iris-button')).not.toBeNull()
    } finally {
      app.unmount()
      container.remove()
    }
  })
})

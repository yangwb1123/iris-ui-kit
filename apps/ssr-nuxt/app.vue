<template>
  <Html lang="en">
    <Body>
      <main style="max-width: 880px; margin: 0 auto; padding: 40px 24px">
        <header style="margin-bottom: 24px">
          <h1 style="margin: 0 0 4px; font-size: 24px">Iris UI · Nuxt 3 SSR smoke</h1>
          <p style="margin: 0; color: var(--iris-muted-foreground, #666)">
            Server-rendered page (<code>app.vue</code>) containing a client island
            (<code>Demo.client.vue</code>) built from <code>@iris-ui/vue</code>. A successful
            <code>nuxi build</code> is the SSR-compat proof.
          </p>
        </header>
        <DemoClient />
      </main>
    </Body>
  </Html>
</template>

<script setup lang="ts">
// Server component — no client reactivity. The import below auto-resolves
// components/Demo.client.vue (the `.client` suffix marks it as a client island).
// Nuxt renders it on the server and hydrates it in the browser.
</script>

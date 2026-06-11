<template>
  <ClientOnly>
    <div class="iris-demo">
      <slot />
    </div>
  </ClientOnly>
</template>

<style>
.iris-demo {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  padding: 20px;
  margin: 16px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--iris-surface, var(--vp-c-bg-soft));
  color: var(--iris-foreground, inherit);
}
</style>

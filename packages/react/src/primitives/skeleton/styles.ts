export const __SKELETON_STYLE_ID = 'iris-skeleton-styles'

const CSS = `
@keyframes iris-skeleton-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
[data-iris-skeleton] {
  display: block;
  background-color: var(--iris-surface);
  border-radius: var(--iris-radius-sm, 4px);
}
[data-iris-skeleton][data-iris-skeleton-animated="true"] {
  /* Fallback shimmer (no color-mix) for engines without it; the color-mix
     gradient below overrides it on modern engines (same source-order cascade). */
  background-image: linear-gradient(
    90deg,
    var(--iris-surface) 0%,
    var(--iris-muted-subtle) 50%,
    var(--iris-surface) 100%
  );
  background-image: linear-gradient(
    90deg,
    var(--iris-surface) 0%,
    color-mix(in srgb, var(--iris-foreground) 8%, var(--iris-surface)) 50%,
    var(--iris-surface) 100%
  );
  background-size: 200% 100%;
  animation: iris-skeleton-shimmer 1.4s linear infinite;
}
[data-iris-skeleton-shape="circle"] {
  border-radius: 50%;
}
[data-iris-skeleton-shape="text"] {
  border-radius: var(--iris-radius-sm, 4px);
}
@media (prefers-reduced-motion: reduce) {
  [data-iris-skeleton][data-iris-skeleton-animated="true"] {
    animation: none;
  }
}
`.trim()

let installed = false

export function installSkeletonStyles(): void {
  if (installed) return
  if (typeof document === 'undefined') return
  if (document.getElementById(__SKELETON_STYLE_ID)) {
    installed = true
    return
  }
  const el = document.createElement('style')
  el.id = __SKELETON_STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
  installed = true
}

export function __resetSkeletonStyles(): void {
  installed = false
  if (typeof document !== 'undefined') {
    document.getElementById(__SKELETON_STYLE_ID)?.remove()
  }
}

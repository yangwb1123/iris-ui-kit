export const PROGRESS_INDETERMINATE_KEYFRAME = 'iris-progress-indeterminate'
export const PROGRESS_INDETERMINATE_ANIMATION = `${PROGRESS_INDETERMINATE_KEYFRAME} 1.2s ease-in-out infinite`

/**
 * Shared progress stylesheet. Adapters only own the DOM stylesheet lifecycle;
 * keeping the selectors and keyframes here prevents animation drift between
 * framework renderers.
 */
export const PROGRESS_STYLES = `
@keyframes ${PROGRESS_INDETERMINATE_KEYFRAME} {
  0%   { left: -40%; right: 100%; }
  60%  { left: 100%; right: -20%; }
  100% { left: 100%; right: -20%; }
}
[data-iris-progress] {
  position: relative;
  overflow: hidden;
  background: var(--iris-surface);
  border-radius: 9999px;
}
[data-iris-progress-bar] {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  border-radius: 9999px;
  transition: width 200ms ease;
}
[data-iris-progress][data-state="indeterminate"] [data-iris-progress-bar] {
  width: auto;
  right: 100%;
  animation: ${PROGRESS_INDETERMINATE_ANIMATION};
}
@media (prefers-reduced-motion: reduce) {
  [data-iris-progress][data-state="indeterminate"] [data-iris-progress-bar] {
    animation: none;
    right: 50%;
    left: 0;
  }
}
`.trim()

// Shared utilities for any "overlay" surface that needs focus containment +
// body scroll suppression: Dialog, future Drawer / Sheet / SidePanel / Modal.
//
// IMPORTANT: `useBodyScrollLock` keeps a module-level reference counter so
// stacked overlays cooperate (closing the inner one does NOT unlock body
// scroll while the outer one is still open). All consumers MUST import from
// this module — duplicating the file would create two independent counters.
export { useFocusTrap, type UseFocusTrapOptions } from './useFocusTrap'
export {
  useBodyScrollLock,
  __getBodyScrollLockCount,
  __resetBodyScrollLock,
} from './useBodyScrollLock'

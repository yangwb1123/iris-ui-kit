/**
 * Framework-agnostic desktop window manager public barrel.
 * Geometry, persistence, contracts, and lifecycle state are kept in focused
 * modules while the `@iris-ui-kit/core/window` API remains unchanged.
 */
export * from './window/types'
export * from './window/geometry'
export * from './window/session'
export { createWindowManager } from './window/manager'

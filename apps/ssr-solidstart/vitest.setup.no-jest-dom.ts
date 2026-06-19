// Intentionally empty. Its filename contains "jest-dom" so vite-plugin-solid's
// auto-setup detection (getJestDomExport) treats jest-dom as already wired and
// does NOT inject `@testing-library/jest-dom/vitest` as a setup file — that
// package is not a dependency here and would fail to resolve under Vitest.
// This test uses only Vitest's built-in expect matchers, so no DOM matchers
// are needed.
export {}

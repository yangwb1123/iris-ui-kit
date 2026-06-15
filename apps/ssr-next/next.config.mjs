/** @type {import('next').NextConfig} */
const nextConfig = {
  // The @iris-ui workspace packages ship ESM/source consumed directly from the
  // monorepo. transpilePackages tells Next to run them through its compiler
  // (instead of treating node_modules as pre-compiled), which is what makes the
  // `workspace:*` resolution + the `'use client'` boundaries resolve cleanly in
  // both the server-render and the client bundle.
  transpilePackages: ['@iris-ui/react', '@iris-ui/core', '@iris-ui/theme', '@iris-ui/tokens'],
  // This app is a build-time SSR/RSC smoke proof, not a deployable surface; a
  // green `next build` (which server-renders every route) is the whole point.
  eslint: {
    // The monorepo's root flat ESLint config is the gate (`pnpm turbo run lint`
    // runs `eslint app` here); skip Next's bundled legacy ESLint during build.
    ignoreDuringBuilds: true,
  },
}

export default nextConfig

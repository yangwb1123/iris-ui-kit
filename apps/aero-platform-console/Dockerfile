FROM node:22.14.0-bookworm-slim AS build

WORKDIR /workspace/apps/aero-platform-console

# Install only the private console manifest. This deliberately excludes the
# pnpm workspace so Iris UI dependencies must resolve from the npm registry.
COPY apps/aero-platform-console/package.json apps/aero-platform-console/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY tsconfig.base.json /workspace/tsconfig.base.json
COPY apps/aero-platform-console/index.html apps/aero-platform-console/tsconfig.json apps/aero-platform-console/vite.config.ts ./
COPY apps/aero-platform-console/public ./public
COPY apps/aero-platform-console/scripts ./scripts
COPY apps/aero-platform-console/src ./src
RUN npm run build

FROM nginx:1.27.4-alpine

COPY apps/aero-platform-console/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/aero-platform-console/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=3 \
  CMD wget -q -O - http://127.0.0.1/healthz >/dev/null || exit 1

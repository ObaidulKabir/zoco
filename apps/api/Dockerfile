# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# Manifests first: this layer only rebuilds when a dependency changes.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json

FROM manifests AS deps
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @zoqo/shared build && pnpm --filter @zoqo/api build

# Production dependencies only, resolved against the same lockfile.
FROM manifests AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter @zoqo/api...

FROM base AS runtime
ENV NODE_ENV=production
# The whole tree, so pnpm's relative workspace symlinks survive the copy.
COPY --from=prod-deps /repo ./
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
# The migrator reads both of these off disk at run time.
COPY --from=build /repo/apps/api/migrations apps/api/migrations
COPY --from=build /repo/infra/postgres infra/postgres

WORKDIR /repo/apps/api
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

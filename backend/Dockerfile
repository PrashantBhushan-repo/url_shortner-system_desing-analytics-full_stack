# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:24-bookworm-slim
FROM ${NODE_IMAGE} AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Only lockfile changes invalidate npm installation.
FROM base AS dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev --no-audit --no-fund

FROM dependencies AS generated
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build ./node_modules/.bin/prisma generate

# Production migration tooling is separate from the application image.
FROM generated AS migration
ENV NODE_ENV=production
COPY prisma ./prisma
COPY --chown=node:node src/config ./src/config
COPY --chown=node:node src/utils/trustProxy.js ./src/utils/trustProxy.js
COPY --chown=node:node scripts/env.mjs ./scripts/env.mjs
COPY --chown=node:node scripts/migrate.mjs ./scripts/migrate.mjs
COPY --chown=node:node scripts/prepare-monitoring.mjs ./scripts/prepare-monitoring.mjs
USER node
CMD ["node", "scripts/migrate.mjs"]

# Local Compose retains Prisma CLI and seeds; production uses target runtime.
FROM generated AS development
COPY . .
ENV NODE_ENV=development
USER node
EXPOSE 5000
CMD ["node", "server.js"]

FROM dependencies AS production-dependencies
RUN --mount=type=cache,target=/root/.npm npm prune --omit=dev --no-audit --no-fund

FROM base AS runtime
ENV NODE_ENV=production PORT=5000 OTEL_SDK_DISABLED=true
# Deployment runs finished images; package managers are unnecessary in the runtime.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json server.js otel.js ./
COPY --chown=node:node src ./src
COPY --from=generated --chown=node:node /app/src/generated/prisma ./src/generated/prisma
COPY --chown=node:node worker ./worker
COPY --chown=node:node bin ./bin
COPY --chown=node:node scripts/healthcheck.mjs ./scripts/healthcheck.mjs
USER node
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=3 CMD ["node", "scripts/healthcheck.mjs"]
CMD ["node", "server.js"]

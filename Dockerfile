FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# The corepack bundled with Node may predate the pnpm version pinned in packageManager
RUN npm install --global corepack@latest && corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store HUSKY=0 pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATA_DIR=/data
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# The PNG is a screenshot taken by Chromium, installed by the same playwright-core version the app
# uses, so the browser revision matches the one the e2e tests run on
RUN --mount=type=bind,from=deps,source=/app/node_modules,target=/deps \
  node /deps/playwright-core/cli.js install --with-deps chromium-headless-shell \
  && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /data && chown node:node /data
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# Migrations are read from disk at startup, so output file tracing doesn't pick them up
COPY --from=build --chown=node:node /app/src/infra/database/migrations ./src/infra/database/migrations
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]

# ArtBeat API — production image.
#
# API only. The scraper lives in `scripts/` and needs Playwright plus a
# ~100MB Chromium; it runs from GitHub Actions (.github/workflows/refresh-data.yml)
# or a laptop, never from this container. Playwright is therefore a
# devDependency and never reaches the runtime layer.

# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Manifests first so the dependency layer caches independently of source.
COPY package*.json ./
COPY prisma ./prisma/

# `npm ci` needs devDependencies here — tsc and prisma are both dev-only.
RUN npm ci

# Prisma's query engine is platform-specific; generate inside the image that
# will run it. schema.prisma lists `native` among its binaryTargets, which
# resolves to linux-musl-openssl on Alpine.
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# dumb-init reaps zombies and forwards SIGTERM so the graceful-shutdown
# handler in src/index.ts actually fires.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system artbeat && adduser --system --ingroup artbeat artbeat

# Install production dependencies fresh rather than copying node_modules and
# pruning: `npm prune` leaves the dev tree's layer weight behind in the image.
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npm cache clean --force

# The generated client is not in `dependencies`, so bring it across explicitly.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist

RUN chown -R artbeat:artbeat /app
USER artbeat

# Overridden by the platform's PORT variable where one is injected.
ENV PORT=3001
EXPOSE 3001

# Liveness only — /ready checks the database and would restart-loop the
# container during a transient Postgres outage.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]

# Migrations are deliberately NOT run here. Two instances starting at once
# would race; run `npx prisma migrate deploy` as a release/pre-deploy step.
CMD ["node", "dist/index.js"]

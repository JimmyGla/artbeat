# ─── Stage 1: builder ────────────────────────────────────────────────────────
# Install all dependencies, generate Prisma client, compile TypeScript.
FROM node:20-alpine AS builder

# Build-time tools needed for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install all deps (including devDependencies needed for tsc)
RUN npm ci

# Generate Prisma client for the current platform
RUN npx prisma generate

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ─── Stage 2: runner ─────────────────────────────────────────────────────────
# Lean production image — only compiled JS + prod node_modules.
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app

# Create a non-root user
RUN addgroup --system artbeat && adduser --system --ingroup artbeat artbeat

# Copy production artifacts from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/prisma        ./prisma

# Prune devDependencies from node_modules in-place
# (prisma & @prisma/client stay — they're prod deps)
RUN npm prune --omit=dev

# Own everything as non-root user
RUN chown -R artbeat:artbeat /app
USER artbeat

# Expose the port Express listens on (overridden by PORT env var)
EXPOSE 3001

# dumb-init handles signal forwarding so Node shuts down gracefully
ENTRYPOINT ["dumb-init", "--"]

# The compose file runs migrations before invoking this CMD via an entrypoint
# script.  In standalone mode this starts the server directly.
CMD ["node", "dist/index.js"]

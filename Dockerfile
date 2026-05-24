# ── Stage 1: Dependencies ──
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package lockfiles to leverage Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Builder ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set dummy env vars for build compilation safety (actual variables injected at runtime)
ENV DATABASE_URL="postgresql://placeholder@localhost:5432/placeholder"
ENV UPSTASH_REDIS_REST_URL="https://placeholder.upstash.io"
ENV UPSTASH_REDIS_REST_TOKEN="placeholder"
ENV NEXT_TELEMETRY_DISABLED=1

# Generate the Prisma client & compile Next.js standalone package
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Runner ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets and public assets
COPY --from=builder /app/public ./public

# Set proper write permissions for Next.js prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Leverage Next.js output file tracing to copy minimal standalone build files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/src/generated/prisma ./src/generated/prisma

USER nextjs

EXPOSE 3000

# standalone Next.js server executes via server.js entrypoint
CMD ["node", "server.js"]

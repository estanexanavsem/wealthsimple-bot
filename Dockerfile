# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Install dependencies
# ============================================
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copy dependency files
COPY package.json bun.lock* ./

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# ============================================
# Stage 2: Production runner
# ============================================
FROM oven/bun:1-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app app

# Create data directory with proper ownership
RUN mkdir -p /data && chown app:app /data

# Copy dependencies from deps stage
COPY --from=deps --chown=app:app /app/node_modules ./node_modules

# Copy application source
COPY --chown=app:app . .

# Switch to non-root user
USER app

# Expose application port
EXPOSE 3000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run the application
CMD ["bun", "run", "start"]

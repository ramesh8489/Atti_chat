# Stage 1: Build & Compile TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache openssl

# Install package manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy source code and config
COPY tsconfig.json ./
COPY src ./src

# Generate Prisma Client & compile TypeScript
RUN npx prisma generate
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install runtime dependencies (OpenSSL for Prisma)
RUN apk add --no-cache openssl curl

# Install only production dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

# Copy generated Prisma Client and compiled JavaScript code from builder
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist

# Create uploads directory with appropriate permissions
RUN mkdir -p uploads && chown -R node:node /app

# Run as non-root user for security
USER node

EXPOSE 5000

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "dist/server.js"]


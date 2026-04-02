# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app

COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client

COPY client/ ./client/
RUN npm run build --prefix client


# ── Stage 2: Production image ──────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Install native build tools, compile better-sqlite3 addon, then remove tools
# (all in one layer to minimise image size)
COPY server/package.json server/package-lock.json ./server/
RUN apk add --no-cache python3 make g++ && \
    npm ci --prefix server --omit=dev && \
    apk del python3 make g++

# Copy server source
COPY server/src/ ./server/src/

# Copy built React frontend from Stage 1
# server/src/index.js resolves static root as path.join(__dirname, '../../client/dist')
# i.e. /app/client/dist
COPY --from=frontend-builder /app/client/dist ./client/dist

# Root package.json (referenced by npm start, kept for tooling compatibility)
COPY package.json ./

# Ensure the SQLite data directory exists for the volume mount
RUN mkdir -p /app/server/data

EXPOSE 3001

CMD ["node", "server/src/index.js"]

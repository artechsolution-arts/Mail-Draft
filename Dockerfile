FROM node:20-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# ── Root (server) dependencies ────────────────────────────────────────────────
COPY package*.json ./
RUN npm ci --omit=dev

# ── Frontend dependencies (cached layer) ─────────────────────────────────────
COPY web-ui/client/package*.json ./web-ui/client/
RUN cd web-ui/client && npm ci

# ── Copy all source ───────────────────────────────────────────────────────────
COPY . .

# ── Build React SPA ───────────────────────────────────────────────────────────
RUN cd web-ui/client && npm run build

EXPOSE 3000

CMD ["sh", "-c", "node crm/migrate.js && exec node web-ui/server.js"]

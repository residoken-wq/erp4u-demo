# Stage 1: Base (Dependency)
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
RUN --mount=type=cache,target=/root/.npm npm install --legacy-peer-deps

# Stage 2: Development (Fast Start)
FROM base AS development
COPY . .
CMD ["npm", "run", "start:dev"]

# Stage 3: Build (Production Build and Seed/Tools runner)
FROM base AS build
COPY . .
RUN npm run build

# Stage 4: Production (Run App)
FROM node:20-alpine AS production
WORKDIR /app
RUN mkdir -p /app/uploads && chown -R node:node /app
COPY package*.json ./
# Only install production deps
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --legacy-peer-deps
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=10s --retries=5 --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1));"
CMD ["node", "dist/main"]

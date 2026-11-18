# Stage 1: Base (Dependency)
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
RUN --mount=type=cache,target=/root/.npm npm install --legacy-peer-deps

# Stage 2: Development (Fast Start)
FROM base AS development
COPY . .
CMD ["npm", "run", "start:dev"]

# Stage 3: Build (Production Build)
FROM base AS build
COPY . .
RUN npm run build

# Stage 4: Production (Run App)
FROM node:18-alpine AS production
WORKDIR /app
COPY package*.json ./
# Only install production deps
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --legacy-peer-deps
COPY --from=build /app/dist ./dist
# Remove hardcoded Firebase credentials copy for security. Mount via docker-compose instead.
CMD ["node", "dist/main"]

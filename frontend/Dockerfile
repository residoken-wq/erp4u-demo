# Stage 1: Base
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install

# Stage 2: Development (Fast Vite Dev Server)
FROM base AS development
COPY . .
# Vite default port
EXPOSE 5173 
CMD ["npm", "run", "dev", "--", "--host"]

# Stage 3: Builder
FROM base AS build
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Stage 4: Production Nginx
FROM nginx:alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz > /dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]

# Blackwall server: serves the built panel and the API (Node 24 runs the
# TypeScript in server/ directly). Built by the Portainer stack in deploy/.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8780
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
USER node
EXPOSE 8780
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8780/healthz || exit 1
CMD ["node", "server/main.ts"]

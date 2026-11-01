# Blackwall server: serves the built panel and the API (Node 24 runs the
# TypeScript in server/ directly). Built by the Portainer stack in deploy/.
FROM node:24-alpine AS build
RUN apk add --no-cache git
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Version stamp: the Git tree hash of these files, the same hash GitHub has for
# blackwall-admin/ when the code is identical. Portainer deletes .git when it
# clones, so this is computed from the files (respecting .gitignore).
RUN git init -q && git add -A && TREE=$(git write-tree) && rm -rf .git \
 && printf '{"tree":"%s","builtAt":"%s"}\n' "$TREE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > build-info.json \
 && echo "build-info: $(cat build-info.json)"
RUN BLACKWALL_BUILD_TREE=$(node -p "require('./build-info.json').tree") npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8780
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/build-info.json ./build-info.json
COPY server ./server
COPY shared ./shared
USER node
EXPOSE 8780
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8780/healthz || exit 1
CMD ["node", "server/main.ts"]

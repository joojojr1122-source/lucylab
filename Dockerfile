# ---- Build web + server, run the server which also serves the web build ----
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/
RUN npm install

FROM base AS web
COPY packages/web ./packages/web
COPY packages/shared ./packages/shared
RUN npm run build --workspace packages/web

FROM base AS server
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
COPY --from=web /app/packages/web/dist ./packages/web/dist
EXPOSE 8787
ENV PORT=8787
ENV NODE_ENV=production
CMD ["node", "packages/server/src/index.js"]

# ---- Server image (Node, runs packages/server) ----
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
RUN npm install --workspace packages/server --workspace packages/shared

FROM base AS server
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
EXPOSE 8787
ENV PORT=8787
CMD ["node", "packages/server/src/index.js"]

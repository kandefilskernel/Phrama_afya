# Construit depuis le dossier web/ : docker build -t nuru-web .
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3100 HOSTNAME=0.0.0.0
# Sortie autonome : seulement ce qu'il faut pour servir l'application.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3100
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:3100/connexion >/dev/null || exit 1
CMD ["node", "server.js"]

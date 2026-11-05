# Construit depuis la racine du projet : docker build -f services/notifications/Dockerfile .
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY libs ./libs
COPY services/notifications/src ./services/notifications/src
ENV NODE_ENV=production DATA_DIR=/data PORT=3001
# Le conteneur tourne sous l'utilisateur node : il doit posséder le dossier des données.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:3001/sante || exit 1
CMD ["node", "services/notifications/src/index.js"]

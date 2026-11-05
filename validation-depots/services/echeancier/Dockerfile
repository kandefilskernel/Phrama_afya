# Construit depuis la racine du projet : docker build -f services/echeancier/Dockerfile .
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY libs ./libs
COPY services/echeancier/src ./services/echeancier/src
ENV NODE_ENV=production DATA_DIR=/data PORT=3002
# Le conteneur tourne sous l'utilisateur node : il doit posséder le dossier des données.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3002
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:3002/sante || exit 1
CMD ["node", "services/echeancier/src/index.js"]

FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY libs ./libs
COPY src ./src
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
# Un volume porte les bases (un fichier par module) pour survivre au redémarrage du conteneur.
# Le conteneur tourne sous l'utilisateur node : il doit posséder le dossier des données.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/sante || exit 1
CMD ["node", "src/app.js"]

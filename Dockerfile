FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js instrument.js telemetry.js index.html ./
COPY libs ./libs
COPY public ./public
USER node
EXPOSE 3000
CMD ["node", "--require", "./telemetry.js", "server.js"]

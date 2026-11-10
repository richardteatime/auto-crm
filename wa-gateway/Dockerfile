FROM node:22-slim
ENV NODE_ENV=production TZ=Europe/Rome
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs ./
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "--max-old-space-size=256", "server.mjs"]

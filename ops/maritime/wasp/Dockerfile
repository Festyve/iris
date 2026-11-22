FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json schema.prisma ./
RUN npm install --no-audit --no-fund && ./node_modules/.bin/prisma generate --schema=schema.prisma
COPY server.cjs ./
ENV NODE_ENV=production WASP_REPO_ONLY=true DATABASE_URL=file:/data/archive.db WASP_SERVER_URL=http://localhost:8080 WASP_WEB_CLIENT_URL=http://localhost:8080
USER node
CMD ["node","server.cjs"]

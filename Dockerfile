# INVTRA — one image for the web app (`npm start`) and the queue worker (`npm run worker`).
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app /app
RUN npm prune --omit=dev --ignore-scripts && npm install --no-save prisma@6.19.3 && useradd -m invtra && mkdir -p /app/storage && chown -R invtra /app/storage
USER invtra
EXPOSE 3000
CMD ["npm", "start"]

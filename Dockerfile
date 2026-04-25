FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci

COPY client/ client/
COPY server/ server/
COPY tsconfig.base.json ./
RUN npm run build -w client && npm run build -w server

FROM node:20-alpine

RUN apk add --no-cache python3 make g++ git

WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci -w server --omit=dev && apk del python3 make g++

COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/client/dist server/public

ENV NODE_ENV=production
EXPOSE 3002
VOLUME /app/data

CMD ["node", "server/dist/index.js"]

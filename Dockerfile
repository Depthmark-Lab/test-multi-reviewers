# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine

WORKDIR /app

RUN addgroup -S probot && adduser -S probot -G probot

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist/ ./dist/

USER probot

EXPOSE 3000

CMD ["npm", "start"]

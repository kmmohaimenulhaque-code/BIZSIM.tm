FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 BIZSIM_DATA_DIR=/data
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server ./server
COPY shared ./shared
COPY --from=build /app/client/dist ./client/dist
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "server/src/index.js"]

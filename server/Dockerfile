FROM node:20-alpine AS builder
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY server/package.json server/package-lock.json* ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
RUN mkdir -p /data/images /data/notes
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]

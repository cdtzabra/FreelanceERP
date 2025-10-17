ARG NODE_VERSION=24-alpine
FROM node:${NODE_VERSION}

LABEL maintainer="Enoks - CdtZabra" \
      website="https://enoks.fr" \
      node_version="${NODE_VERSION}"

ENV DB_DIR=/opt/data

RUN mkdir -p /app/erp /opt/data && apk add --no-cache sqlite

WORKDIR /app/erp

COPY src/package*.json ./
RUN npm install --omit=dev

COPY src/ .

CMD ["node", "server.js"]

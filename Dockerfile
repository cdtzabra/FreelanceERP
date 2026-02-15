# ============================
# 1. Build stage
# ============================
ARG NODE_VERSION=25-alpine
FROM node:${NODE_VERSION} AS builder

WORKDIR /app/erp

# Copy dependency files
COPY src/package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm install --omit=dev

# Copy source code
COPY src/ .

# ============================
# 2. Runtime stage
# ============================
FROM node:${NODE_VERSION} AS runtime

LABEL maintainer="Enoks - CdtZabra" \
      website="https://enoks.fr" \
      node_version="${NODE_VERSION}"

ARG DB_DIR=/opt/data
ENV DB_DIR=${DB_DIR} 
WORKDIR /app/erp

RUN mkdir -p ${DB_DIR} && apk add --no-cache sqlite

# Copy  only necessary files from builder stage
COPY --from=builder /app/erp /app/erp

EXPOSE 3001

CMD ["node", "server.js"]
# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:24-bookworm-slim
ARG NGINX_IMAGE=nginx:1.30.6-alpine-slim
FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev --no-audit --no-fund

FROM dependencies AS build
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM ${NGINX_IMAGE} AS runtime
RUN cp /etc/nginx/nginx.conf /tmp/pburls-nginx.conf \
    && apk upgrade --no-cache \
    && cp /tmp/pburls-nginx.conf /etc/nginx/nginx.conf \
    && rm /tmp/pburls-nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-http.conf /etc/nginx/conf.d/00-pburls.conf
COPY nginx-routes.conf /etc/nginx/snippets/pburls-routes.conf
COPY nginx-security.conf /etc/nginx/snippets/pburls-security.conf
EXPOSE 80 443
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]

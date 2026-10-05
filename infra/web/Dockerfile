FROM node:24-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY backend/openapi.json /backend/openapi.json
RUN npm run build

FROM nginx:1.29-alpine
COPY infra/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY infra/web/config.json.template /etc/nginx/templates/config.json.template
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
ENV API_URL=http://localhost:4400 OIDC_AUTHORITY=http://localhost:4480/realms/northwind OIDC_CLIENT_ID=kb-web
CMD ["/bin/sh", "-c", "envsubst < /etc/nginx/templates/config.json.template > /usr/share/nginx/html/config.json && exec nginx -g 'daemon off;'"]

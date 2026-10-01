# Prefer host-built assets to avoid flaky npm-in-Docker installs.
# Build with: (cd apps/web && npm ci && npm run build) then docker compose build web
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_COORDINATOR_URL=http://localhost:8080
ARG VITE_WEB_API_KEY=dev-web-key
ARG VITE_SINGPASS_MODE=mock
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=

ENV VITE_COORDINATOR_URL=$VITE_COORDINATOR_URL \
    VITE_WEB_API_KEY=$VITE_WEB_API_KEY \
    VITE_SINGPASS_MODE=$VITE_SINGPASS_MODE \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

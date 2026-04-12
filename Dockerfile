# Stage 1 — Build the static site
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG BASE_URL=""
ENV BASE_URL=${BASE_URL}

RUN npm run build

# Stage 2 — Serve with nginx
FROM nginx:alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

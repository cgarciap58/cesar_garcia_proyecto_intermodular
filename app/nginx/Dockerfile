# 1. Build React
FROM node:20-alpine AS build

WORKDIR /app
RUN npm install
RUN npm run build

# 2. Nginx runtime
FROM nginx:latest

COPY default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /var/www/react

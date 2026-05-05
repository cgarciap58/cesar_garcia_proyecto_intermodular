FROM node:20-alpine AS build

WORKDIR /app

COPY react/getbetter/package*.json ./
RUN npm install

COPY react/getbetter/ .

RUN npm run build

FROM nginx:latest

COPY nginx/default.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html
FROM node:20-alpine AS build

WORKDIR /app

COPY ./react/getbetter/package*.json ./
RUN npm install

COPY app/react/getbetter/ .

RUN npm run build

FROM nginx:latest

COPY app/nginx/default.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html
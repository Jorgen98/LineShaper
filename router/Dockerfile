FROM node:26-slim AS build

WORKDIR /dist/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM nginx:alpine AS ng

COPY --from=build /dist/src/app/dist/router/browser/ \
    /usr/share/nginx/html/lineShaper/lineRouter/

COPY nginx-custom.conf /etc/nginx/conf.d/default.conf

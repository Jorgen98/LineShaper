FROM node:26-slim AS build

WORKDIR /dist/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM nginx:alpine AS ng

COPY --from=build /dist/src/app/dist/editor/browser/ \
    /usr/share/nginx/html/lineShaper/mapEditor/

COPY nginx-custom.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

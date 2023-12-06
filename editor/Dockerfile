FROM node:latest AS build

WORKDIR /dist/src/app

RUN npm cache clean --force
COPY . .

RUN npm install
RUN npm run build

FROM nginx:latest AS ng

COPY --from=build /dist/src/app/dist/editor/ /usr/share/nginx/html/mapEditor/
COPY /nginx-custom.conf  /etc/nginx/conf.d/default.conf

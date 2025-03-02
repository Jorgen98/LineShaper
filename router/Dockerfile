FROM node:current AS build

WORKDIR /dist/src/app

RUN npm cache clean --force
COPY . .

RUN npm install
RUN npm run build

FROM nginx:latest AS ng

COPY --from=build /dist/src/app/dist/router/ /usr/share/nginx/html/lineShaper/lineRouter/
COPY /nginx-custom.conf  /etc/nginx/conf.d/default.conf

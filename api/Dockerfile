FROM node:latest

WORKDIR /

COPY package*.json ./

RUN npm install

COPY . .

CMD npm run docker_run
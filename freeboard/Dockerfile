FROM node:10 AS base

RUN git clone https://github.com/Freeboard/freeboard.git
WORKDIR freeboard
RUN npm i -g npm grunt
RUN npm i
RUN grunt

FROM nginx:stable-alpine

COPY dashboard.json /usr/share/nginx/html/dashboard.json
COPY --from=base freeboard/ /usr/share/nginx/html

FROM nginx:stable-alpine

COPY dashboard.json /usr/share/nginx/html/dashboard.json

RUN apk --no-cache add ca-certificates wget tar \
  && wget -O freeboard.tar.gz https://api.github.com/repos/Freeboard/freeboard/tarball/master \
  && tar -xzvf freeboard.tar.gz -C /usr/share/nginx/html --strip-components=1

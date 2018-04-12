FROM alpine:latest
#for RaspberryPi
#FROM armhf/alpine

RUN apk add --update nodejs
COPY . /src
RUN cd /src; npm install

CMD ["node","/src/tempConversion.js"]
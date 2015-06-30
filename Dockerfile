FROM alpine:3.2

ENV DIG_VERSION 9.10.2

WORKDIR /app
COPY ./package.json /app/
COPY ./src /app
RUN apk update \
  && apk add nodejs openssl \
  && wget -O - https://github.com/sequenceiq/docker-alpine-dig/releases/download/v${DIG_VERSION}/dig.tgz|tar -xzv -C /usr/local/bin/ \
  && npm install \
  && apk del openssl \
  && rm -rf /tmp/* /root/.npm /root/.node-gyp

ENTRYPOINT ["node", "index.js"]
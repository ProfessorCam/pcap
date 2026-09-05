# Static teaching site served by nginx. No build step.
FROM nginx:1.27-alpine

# iproute2 gives the real `ip -j` (JSON output) used by netinfo.sh
RUN apk add --no-cache iproute2

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
COPY netinfo.sh /docker-entrypoint.d/50-netinfo.sh

EXPOSE 8080

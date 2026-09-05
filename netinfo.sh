#!/bin/sh
# Runs inside the container at startup (nginx's /docker-entrypoint.d hook).
# Because the container uses network_mode: host, `ip` here sees the real
# Wi-Fi and wired interfaces of the machine running Docker. Every few seconds
# it writes what it sees to network.json, which the welcome page fetches.
OUT=/usr/share/nginx/html/network.json
TMP=/tmp/network.json.tmp

write_json() {
  addr=$(ip -j addr show 2>/dev/null) || addr='[]'
  route=$(ip -j route show 2>/dev/null) || route='[]'
  wireless=''
  for d in /sys/class/net/*; do
    if [ -d "$d/wireless" ] || [ -d "$d/phy80211" ]; then wireless="$wireless\"$(basename "$d")\","; fi
  done
  wireless="[${wireless%,}]"
  dns=''
  for ns in $(awk '/^nameserver/ {print $2}' /etc/resolv.conf 2>/dev/null); do dns="$dns\"$ns\","; done
  dns="[${dns%,}]"
  printf '{"generated":"%s","hostname":"%s","addr":%s,"route":%s,"wireless":%s,"dns":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(hostname)" "$addr" "$route" "$wireless" "$dns" > "$TMP" && mv "$TMP" "$OUT"
}

write_json
( while true; do sleep 5; write_json; done ) &

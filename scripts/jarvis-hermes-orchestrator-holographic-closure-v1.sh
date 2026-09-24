#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PROFILE="jarvis-orchestrator"
HOST_HERMES_HOME="/home/jarvis/.hermes"
PROFILE_HOME="/opt/data/profiles/$PROFILE"
PORT="8643"
SUCCESS=0
CHANGED=0
BACKUP=""
CID=""
HUID=""
HGID=""

fail() {
  echo "HERMES_ORCHESTRATOR_HOLOGRAPHIC_CLOSURE=FAIL"
  echo "FAILURE_REASON=$1"
  exit "${2:-1}"
}

rollback() {
  rc=$?
  if [[ "$SUCCESS" != "1" && "$CHANGED" == "1" && -n "$CID" && -n "$BACKUP" ]]; then
    echo "ROLLBACK=START"
    sudo docker exec -u "$HUID:$HGID" "$CID" cp -p "$BACKUP" "$PROFILE_HOME/config.yaml" >/dev/null 2>&1 || true
    sudo docker exec -u "$HUID:$HGID" "$CID" /opt/hermes/.venv/bin/hermes -p "$PROFILE" gateway restart >/dev/null 2>&1 || true
    echo "ROLLBACK=ATTEMPTED"
  fi
  exit "$rc"
}
trap rollback EXIT

[[ "$(id -un)" == "jarvis" ]] || fail "RUN_AS_JARVIS_REQUIRED" 10
command -v docker >/dev/null 2>&1 || fail "DOCKER_BINARY_MISSING" 11
command -v curl >/dev/null 2>&1 || fail "CURL_MISSING" 12
sudo -v

echo "=== JARVIS ORCHESTRATOR HOLOGRAPHIC CLOSURE V1 ==="
echo "PROFILE=$PROFILE"

test "$(systemctl is-active jarvis-remote-operator.service 2>/dev/null || true)" = "active" \
  || fail "JARVIS_REMOTE_OPERATOR_NOT_ACTIVE" 13
echo "JARVIS_REMOTE_OPERATOR_PRE=ACTIVE"

PID="$(ps -eo pid,args --no-headers | awk '/\/opt\/hermes\/\.venv\/bin\/hermes -p jarvis-orchestrator gateway run --replace/ {print $1; exit}')"
[[ -n "$PID" ]] || fail "ORCHESTRATOR_GATEWAY_PID_NOT_FOUND" 14
echo "ORCHESTRATOR_PID=$PID"

CID="$(grep -oE 'docker-[0-9a-f]{64}\.scope' "/proc/$PID/cgroup" 2>/dev/null | head -1 | sed 's/^docker-//;s/\.scope$//' || true)"
if [[ -z "$CID" ]]; then
  while IFS= read -r candidate; do
    mount_line="$(sudo docker inspect -f '{{range .Mounts}}{{if eq .Destination "/opt/data"}}{{println .Source "->" .Destination}}{{end}}{{end}}' "$candidate" 2>/dev/null || true)"
    if grep -Fq "$HOST_HERMES_HOME -> /opt/data" <<<"$mount_line"; then
      CID="$candidate"
      break
    fi
  done < <(sudo docker ps -q --no-trunc)
fi
[[ -n "$CID" ]] || fail "HERMES_CONTAINER_NOT_FOUND" 15
sudo docker inspect "$CID" >/dev/null 2>&1 || fail "HERMES_CONTAINER_INSPECT_FAILED" 16
echo "HERMES_CONTAINER=${CID:0:12}"

MOUNT_LINE="$(sudo docker inspect -f '{{range .Mounts}}{{if eq .Destination "/opt/data"}}{{println .Source "->" .Destination}}{{end}}{{end}}' "$CID")"
grep -Fq "$HOST_HERMES_HOME -> /opt/data" <<<"$MOUNT_LINE" \
  || fail "EXPECTED_HERMES_BIND_MOUNT_MISSING" 17
echo "HERMES_BIND_MOUNT=PASS"

HUID="$(sudo docker exec "$CID" id -u hermes)"
HGID="$(sudo docker exec "$CID" id -g hermes)"
[[ "$HUID" =~ ^[0-9]+$ && "$HGID" =~ ^[0-9]+$ ]] || fail "INVALID_CONTAINER_HERMES_UID_GID" 18
echo "CONTAINER_HERMES_UID=$HUID"
echo "CONTAINER_HERMES_GID=$HGID"

sudo docker exec "$CID" test -d "$PROFILE_HOME" \
  || fail "ORCHESTRATOR_PROFILE_HOME_MISSING" 19
sudo docker exec "$CID" test -f "$PROFILE_HOME/config.yaml" \
  || fail "ORCHESTRATOR_PROFILE_CONFIG_MISSING" 20

echo "=== WRITEABILITY PREFLIGHT ==="
if ! sudo docker exec -u "$HUID:$HGID" "$CID" sh -lc "test -r '$PROFILE_HOME/config.yaml' && test -w '$PROFILE_HOME/config.yaml' && test -w '$PROFILE_HOME'"; then
  echo "PROFILE_ACCESS_AS_CONTAINER_HERMES=FAIL"
  echo "OWNERSHIP_REPAIR_SCOPE=$HOST_HERMES_HOME"
  echo "OWNERSHIP_REPAIR_TARGET=$HUID:$HGID"

  # The official Hermes Docker runtime writes the bind-mounted /opt/data as its
  # hermes UID/GID. Earlier host-side diagnostics temporarily changed this tree
  # to the host jarvis UID, which can make the live gateway unable to persist.
  sudo chown -R "$HUID:$HGID" "$HOST_HERMES_HOME"

  if ! sudo docker exec -u "$HUID:$HGID" "$CID" sh -lc "test -r '$PROFILE_HOME/config.yaml' && test -w '$PROFILE_HOME/config.yaml' && test -w '$PROFILE_HOME'"; then
    sudo stat -c 'HOST_PATH=%n UID=%u GID=%g MODE=%a' "$HOST_HERMES_HOME" "$HOST_HERMES_HOME/profiles/$PROFILE" "$HOST_HERMES_HOME/profiles/$PROFILE/config.yaml" 2>/dev/null || true
    sudo docker exec "$CID" stat -c 'CONTAINER_PATH=%n UID=%u GID=%g MODE=%a' /opt/data "$PROFILE_HOME" "$PROFILE_HOME/config.yaml" 2>/dev/null || true
    fail "CONTAINER_HERMES_STILL_CANNOT_WRITE_AFTER_OWNERSHIP_REPAIR" 21
  fi

  echo "OWNERSHIP_REPAIRED_TO_CONTAINER_HERMES=PASS"
fi
echo "PROFILE_ACCESS_AS_CONTAINER_HERMES=PASS"

CURRENT_PROVIDER="$(sudo docker exec -u "$HUID:$HGID" "$CID" /opt/hermes/.venv/bin/hermes -p "$PROFILE" config get memory.provider 2>/dev/null | tr -d '\r' | tail -1 | xargs || true)"
echo "CURRENT_MEMORY_PROVIDER=${CURRENT_PROVIDER:-unset}"

if [[ "$CURRENT_PROVIDER" != "holographic" ]]; then
  TS="$(date -u +%Y%m%dT%H%M%SZ)"
  BACKUP="$PROFILE_HOME/config.yaml.bak-holographic-closure-v1-$TS"
  sudo docker exec -u "$HUID:$HGID" "$CID" cp -p "$PROFILE_HOME/config.yaml" "$BACKUP"
  echo "PROFILE_CONFIG_BACKUP=$BACKUP"

  sudo docker exec -u "$HUID:$HGID" "$CID" /opt/hermes/.venv/bin/hermes -p "$PROFILE" config set memory.provider holographic >/dev/null
  CHANGED=1

  WRITTEN_PROVIDER="$(sudo docker exec -u "$HUID:$HGID" "$CID" /opt/hermes/.venv/bin/hermes -p "$PROFILE" config get memory.provider 2>/dev/null | tr -d '\r' | tail -1 | xargs)"
  [[ "$WRITTEN_PROVIDER" == "holographic" ]] || fail "PROFILE_PROVIDER_WRITE_MISMATCH" 22
  echo "PROFILE_MEMORY_PROVIDER_WRITTEN=holographic"
else
  echo "PROFILE_MEMORY_PROVIDER_ALREADY=holographic"
fi

echo "=== PROFILE GATEWAY RESTART ==="
sudo docker exec -u "$HUID:$HGID" "$CID" /opt/hermes/.venv/bin/hermes -p "$PROFILE" gateway restart
echo "PROFILE_GATEWAY_RESTART=ISSUED"

IP="$(sudo docker inspect -f '{{range .NetworkSettings.Networks}}{{println .IPAddress}}{{end}}' "$CID" | awk 'NF{print; exit}')"
[[ -n "$IP" ]] || fail "HERMES_CONTAINER_IP_MISSING" 23

HEALTH=0
for _ in $(seq 1 20); do
  if curl -fsS --max-time 2 "http://$IP:$PORT/health" >/dev/null 2>&1; then
    HEALTH=1
    break
  fi
  sleep 1
done
[[ "$HEALTH" == "1" ]] || fail "ORCHESTRATOR_HEALTHCHECK_FAILED" 24
echo "ORCHESTRATOR_HEALTH=PASS"

LIVE_PROVIDER="$(sudo docker exec -u "$HUID:$HGID" "$CID" /opt/hermes/.venv/bin/hermes -p "$PROFILE" config get memory.provider 2>/dev/null | tr -d '\r' | tail -1 | xargs)"
[[ "$LIVE_PROVIDER" == "holographic" ]] || fail "LIVE_PROVIDER_MISMATCH" 25
echo "LIVE_MEMORY_PROVIDER=holographic"

echo "=== PROFILE-SCOPED HOLOGRAPHIC E2E ==="
sudo docker exec -i -u "$HUID:$HGID" -e HERMES_HOME="$PROFILE_HOME" "$CID" /opt/hermes/.venv/bin/python3 - <<'PY'
import json
import os
import time
from pathlib import Path

from plugins.memory.holographic import HolographicMemoryProvider

home = Path(os.environ["HERMES_HOME"])
db = home / "memory_store.db"
marker = f"JARVIS orchestrator holographic closure marker {time.time_ns()}"

p1 = HolographicMemoryProvider()
p1.initialize("jarvis-orchestrator-holographic-closure-session-a")
added = json.loads(p1.handle_tool_call("fact_store", {
    "action": "add",
    "content": marker,
    "category": "project",
    "tags": "jarvis,orchestrator,e2e,temporary"
}))
assert added.get("status") == "added", added
fact_id = int(added["fact_id"])
p1.shutdown()

p2 = HolographicMemoryProvider()
p2.initialize("jarvis-orchestrator-holographic-closure-session-b")
context = p2.prefetch("JARVIS orchestrator holographic closure marker")
assert marker in context, context
search = json.loads(p2.handle_tool_call("fact_store", {
    "action": "search",
    "query": "JARVIS orchestrator holographic closure marker",
    "limit": 20
}))
assert any(int(row.get("fact_id", -1)) == fact_id and row.get("content") == marker for row in search.get("results", [])), search
removed = json.loads(p2.handle_tool_call("fact_store", {"action": "remove", "fact_id": fact_id}))
assert removed.get("removed") is True, removed
post = json.loads(p2.handle_tool_call("fact_store", {
    "action": "search",
    "query": "JARVIS orchestrator holographic closure marker",
    "limit": 20
}))
assert not any(int(row.get("fact_id", -1)) == fact_id for row in post.get("results", [])), post
p2.shutdown()

assert db.exists(), db
print(f"PROFILE_MEMORY_DB={db}")
print("PROFILE_HOLOGRAPHIC_SQLITE=READY")
print("PROFILE_CROSS_SESSION_ADD_SEARCH_REMOVE=PASS")
print("PROFILE_MEMORY_PREFETCH_NEW_SESSION=PASS")
PY

test "$(systemctl is-active jarvis-remote-operator.service 2>/dev/null || true)" = "active" \
  || fail "JARVIS_REMOTE_OPERATOR_NOT_ACTIVE_AFTER_RESTART" 26
echo "JARVIS_REMOTE_OPERATOR_POST=ACTIVE"

ps -eo pid,user,group,args --no-headers \
  | grep -F "/opt/hermes/.venv/bin/hermes -p $PROFILE gateway run --replace" \
  | grep -v grep \
  | head -1 >/dev/null \
  || fail "ORCHESTRATOR_GATEWAY_PROCESS_MISSING_AFTER_RESTART" 27
echo "ORCHESTRATOR_GATEWAY_PROCESS=RUNNING"

SUCCESS=1
echo "JARVIS_ORCHESTRATOR_HOLOGRAPHIC_CLOSURE=PASS"

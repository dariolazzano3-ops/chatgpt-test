#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ "$(id -un)" == "jarvis" ]] || { echo HERMES_MEMORY_ACTIVATION_USER_MISMATCH; exit 10; }

HERMES_HOME="${HERMES_HOME:-/home/jarvis/.hermes}"
[[ -e "$HERMES_HOME" ]] || { echo HERMES_HOME_MISSING; exit 11; }

HERMES_REPO=""
for candidate in   /home/jarvis/claude-worker/workspace/hermes-rate-limit-resilience-v1   /home/jarvis/.hermes/hermes-agent
do
  if [[ -f "$candidate/hermes" && -d "$candidate/plugins/memory/holographic" ]]; then
    HERMES_REPO="$candidate"
    break
  fi
done
[[ -n "$HERMES_REPO" ]] || { echo HERMES_REPO_NOT_FOUND; exit 12; }

PY=""
for candidate in   "$HERMES_REPO/venv/bin/python"   "$HERMES_REPO/.venv/bin/python"
do
  if [[ -x "$candidate" ]]; then PY="$candidate"; break; fi
done
if [[ -z "$PY" ]]; then
  PY="$(command -v python3 || true)"
fi
[[ -n "$PY" && -x "$PY" ]] || { echo HERMES_PYTHON_NOT_FOUND; exit 13; }

CONFIG="$HERMES_HOME/config.yaml"
CONFIG_EXISTED=0
BACKUP=""
SUCCESS=0

if [[ -f "$CONFIG" ]]; then
  CONFIG_EXISTED=1
  BACKUP="$(mktemp /tmp/jarvis-hermes-config-backup.XXXXXX)"
  cp -p "$CONFIG" "$BACKUP"
fi

rollback() {
  rc=$?
  if [[ "$SUCCESS" != 1 ]]; then
    if [[ "$CONFIG_EXISTED" == 1 && -n "$BACKUP" && -f "$BACKUP" ]]; then
      cp -p "$BACKUP" "$CONFIG" || true
      echo HERMES_CONFIG_ROLLBACK=RESTORED
    elif [[ "$CONFIG_EXISTED" == 0 ]]; then
      rm -f "$CONFIG" || true
      echo HERMES_CONFIG_ROLLBACK=REMOVED_NEW_CONFIG
    fi
  fi
  [[ -z "$BACKUP" ]] || rm -f "$BACKUP" || true
  exit "$rc"
}
trap rollback EXIT

echo "HERMES_REPO=$HERMES_REPO"
echo "HERMES_HOME=$HERMES_HOME"

HERMES_HOME="$HERMES_HOME" "$PY" "$HERMES_REPO/hermes" config set memory.provider holographic >/dev/null
PROVIDER="$(HERMES_HOME="$HERMES_HOME" "$PY" "$HERMES_REPO/hermes" config get memory.provider | tr -d '\r' | tail -1 | xargs)"
[[ "$PROVIDER" == "holographic" ]] || { echo HERMES_MEMORY_PROVIDER_CONFIG_MISMATCH; exit 14; }
echo HERMES_MEMORY_PROVIDER=holographic

HERMES_HOME="$HERMES_HOME" PYTHONPATH="$HERMES_REPO" "$PY" - <<'PY'
import json
import os
from pathlib import Path

from plugins.memory.holographic import HolographicMemoryProvider

home = Path(os.environ["HERMES_HOME"]).expanduser()
marker = "JARVIS Holographic E2E marker 2026-09-24 owner-memory-persistence"
db = home / "memory_store.db"

p1 = HolographicMemoryProvider()
p1.initialize("jarvis-holographic-e2e-session-a")
raw = p1.handle_tool_call("fact_store", {
    "action": "add",
    "content": marker,
    "category": "project",
    "tags": "jarvis,e2e,temporary"
})
added = json.loads(raw)
fact_id = int(added["fact_id"])
assert added.get("status") == "added"
p1.shutdown()

p2 = HolographicMemoryProvider()
p2.initialize("jarvis-holographic-e2e-session-b")
context = p2.prefetch("JARVIS Holographic E2E owner memory persistence")
assert marker in context, context
search = json.loads(p2.handle_tool_call("fact_store", {
    "action": "search",
    "query": "JARVIS Holographic E2E owner memory persistence",
    "limit": 10
}))
assert any(row.get("fact_id") == fact_id and row.get("content") == marker for row in search.get("results", []))
removed = json.loads(p2.handle_tool_call("fact_store", {"action": "remove", "fact_id": fact_id}))
assert removed.get("removed") is True
post = json.loads(p2.handle_tool_call("fact_store", {
    "action": "search",
    "query": "JARVIS Holographic E2E owner memory persistence",
    "limit": 10
}))
assert not any(row.get("fact_id") == fact_id for row in post.get("results", []))
p2.shutdown()

assert db.exists(), db
print("HERMES_HOLOGRAPHIC_SQLITE=READY")
print("HERMES_CROSS_SESSION_ADD_SEARCH_REMOVE=PASS")
print("HERMES_MEMORY_PREFETCH_NEW_SESSION=PASS")
PY

HERMES_HOME="$HERMES_HOME" "$PY" "$HERMES_REPO/hermes" config check >/dev/null || {
  echo HERMES_CONFIG_CHECK_FAIL
  exit 15
}

SUCCESS=1
echo HERMES_HOLOGRAPHIC_MEMORY_V1=PASS

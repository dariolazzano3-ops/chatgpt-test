#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SRC="${1:-}"
EXPECTED_HEAD="${2:-}"
BRANCH=factory/jarvis-astra-codex-review-v1
ENV=/etc/jarvis/remote-operator.env
SERVICE=jarvis-remote-operator.service
RUNTIME=/opt/jarvis/chatgpt-test
BACKUP=""
ENV_CHANGED=0
SUCCESS=0

fail() {
  echo "JARVIS_ASTRA_CODEX_LIVE_CLOSURE=FAIL"
  echo "FAILURE_REASON=$1"
  exit "${2:-1}"
}

rollback() {
  rc=$?
  if [[ "$SUCCESS" != "1" && "$ENV_CHANGED" == "1" && -n "$BACKUP" ]]; then
    echo "ASTRA_ENV_ROLLBACK=START"
    sudo cp -p "$BACKUP" "$ENV" >/dev/null 2>&1 || true
    sudo systemctl restart "$SERVICE" >/dev/null 2>&1 || true
    echo "ASTRA_ENV_ROLLBACK=ATTEMPTED"
  fi
  [[ -z "$BACKUP" ]] || sudo rm -f "$BACKUP" >/dev/null 2>&1 || true
  exit "$rc"
}
trap rollback EXIT

[[ "$(id -un)" == "jarvis" ]] || fail "RUN_AS_JARVIS_REQUIRED" 10
[[ -d "$SRC/.git" ]] || fail "SOURCE_REPO_REQUIRED" 11
[[ "$EXPECTED_HEAD" =~ ^[0-9a-f]{40}$ ]] || fail "EXPECTED_HEAD_INVALID" 12
[[ "$(git -C "$SRC" rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || fail "SOURCE_HEAD_MISMATCH" 13
[[ "$(git -C "$SRC" branch --show-current)" == "$BRANCH" ]] || fail "SOURCE_BRANCH_MISMATCH" 14
[[ -z "$(git -C "$SRC" status --porcelain)" ]] || fail "SOURCE_DIRTY" 15
[[ -f "$SRC/scripts/jarvis-hermes-orchestrator-holographic-closure-v1.sh" ]] || fail "MEMORY_CLOSURE_SCRIPT_MISSING" 16
[[ -f "$SRC/scripts/jarvis-astra-codex-review-v1-deploy.sh" ]] || fail "ASTRA_DEPLOY_SCRIPT_MISSING" 17
sudo test -f "$ENV" || fail "REMOTE_OPERATOR_ENV_MISSING" 18

sudo -v

echo "=== 1/5 MEMORY LIVE CLOSURE ==="
bash "$SRC/scripts/jarvis-hermes-orchestrator-holographic-closure-v1.sh"
echo "MEMORY_LIVE_CLOSURE=PASS"

echo "=== 2/5 ASTRA CODE DEPLOY ==="
bash "$SRC/scripts/jarvis-astra-codex-review-v1-deploy.sh" "$SRC" "$EXPECTED_HEAD"
echo "ASTRA_CODE_DEPLOY=PASS"

echo "=== 3/5 PRE-ACTIVATION TRUTH ==="
sudo systemctl is-active --quiet "$SERVICE" || fail "REMOTE_OPERATOR_NOT_ACTIVE_BEFORE_FLAG" 19
for rel in src/jarvis/intelligence-router-v1.js src/jarvis/owner-chat-job-v1.js src/jarvis/http-v1.js; do
  sudo test -f "$RUNTIME/$rel" || fail "LIVE_RUNTIME_FILE_MISSING:$rel" 20
  SOURCE_SHA="$(sha256sum "$SRC/$rel" | awk '{print $1}')"
  RUNTIME_SHA="$(sudo sha256sum "$RUNTIME/$rel" | awk '{print $1}')"
  [[ "$SOURCE_SHA" == "$RUNTIME_SHA" ]] || fail "LIVE_RUNTIME_FILE_MISMATCH:$rel" 21
done
sudo grep -Fq "astra_post_review_live_supported: true" "$RUNTIME/src/jarvis/intelligence-router-v1.js" \
  || fail "ASTRA_REVIEW_CODE_MARKER_MISSING" 22
sudo grep -Fq "JARVIS_ASTRA_POST_REVIEW_ENABLED" "$RUNTIME/src/jarvis/http-v1.js" \
  || fail "ASTRA_HTTP_FLAG_CODE_MARKER_MISSING" 23
echo "PRE_ACTIVATION_TRUTH=PASS"

echo "=== 4/5 ENABLE ASTRA POST REVIEW ==="
BACKUP="$(sudo mktemp /etc/jarvis/.remote-operator.env.astra-backup.XXXXXX)"
sudo cp -p "$ENV" "$BACKUP"

sudo python3 - "$ENV" <<'PY'
import os, stat, sys, tempfile
path=sys.argv[1]
st=os.stat(path)
with open(path,encoding='utf-8') as f:
    lines=f.read().splitlines()
lines=[line for line in lines if not line.startswith('JARVIS_ASTRA_POST_REVIEW_ENABLED=')]
lines.append('JARVIS_ASTRA_POST_REVIEW_ENABLED=true')
fd,tmp=tempfile.mkstemp(prefix='.remote-operator.env.astra.',dir=os.path.dirname(path),text=True)
try:
    os.fchmod(fd, stat.S_IMODE(st.st_mode))
    os.fchown(fd, st.st_uid, st.st_gid)
    with os.fdopen(fd,'w',encoding='utf-8') as f:
        f.write('\n'.join(lines)+'\n')
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp,path)
finally:
    if os.path.exists(tmp):
        os.unlink(tmp)
PY
ENV_CHANGED=1

sudo systemctl restart "$SERVICE"

HTTP=""
for _ in $(seq 1 30); do
  if sudo systemctl is-active --quiet "$SERVICE"; then
    HTTP="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:8788/ 2>/dev/null || true)"
    [[ "$HTTP" == "401" ]] && break
  fi
  sleep 1
done
[[ "$HTTP" == "401" ]] || fail "PRIVATE_OPERATOR_HTTP_NOT_HEALTHY:${HTTP:-none}" 24

PID="$(sudo systemctl show "$SERVICE" -p MainPID --value)"
[[ "$PID" =~ ^[0-9]+$ && "$PID" -gt 1 ]] || fail "REMOTE_OPERATOR_PID_INVALID" 25
sudo sh -c "tr '\\0' '\\n' </proc/$PID/environ" 2>/dev/null | grep -qx 'JARVIS_ASTRA_POST_REVIEW_ENABLED=true' \
  || fail "ASTRA_FLAG_NOT_VISIBLE_IN_LIVE_PROCESS" 26

echo "ASTRA_POST_REVIEW_FLAG=LIVE"

echo "=== 5/5 FINAL PRIVATE RUNTIME TRUTH ==="
sudo systemctl is-active --quiet "$SERVICE" || fail "REMOTE_OPERATOR_NOT_ACTIVE_AFTER_FLAG" 27
[[ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:8788/ 2>/dev/null || true)" == "401" ]] \
  || fail "PRIVATE_ACCESS_BOUNDARY_CHANGED" 28

echo "SOURCE_HEAD=$EXPECTED_HEAD"
echo "MEMORY_PROVIDER=holographic"
echo "ASTRA_PRE_PLANNER=HERMES_OPENAI_CODEX"
echo "CLAUDE_EXECUTION_PATH=UNCHANGED"
echo "ASTRA_POST_REVIEW=ENABLED"
echo "PRIVATE_OPERATOR_SERVICE=active"
echo "PRIVATE_OPERATOR_HTTP=401"
echo "PUBLIC_PRODUCTION_DNS_BILLING=UNCHANGED"

SUCCESS=1
sudo rm -f "$BACKUP"
BACKUP=""
echo "JARVIS_ASTRA_CODEX_LIVE_CLOSURE=PASS"

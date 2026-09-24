#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SRC="${1:-}"
EXPECTED_HEAD="${2:-}"
FEATURE_BRANCH=factory/jarvis-owner-chat-auto-finalize-v1
RUNTIME_BRANCH=factory/jarvis-capability-expansion-v3
TARGET=/home/jarvis/claude-worker/workspace/chatgpt-test-owner-runtime-v1
RUNTIME=/opt/jarvis/chatgpt-test-owner-auto-finalize-v1
LEGACY_PATH=/opt/jarvis/chatgpt-test
MOUNT=/opt/jarvis/owner-chat-repo
PROJECT=chatgpt-test-owner-runtime-v1
QUEUE=/opt/jarvis/owner-deploy-queue
RESULTS="$QUEUE/results"
WATCHER=/home/jarvis/.local/bin/jarvis-owner-private-deploy-watch-v1.sh
SERVICE=jarvis-remote-operator.service
ENV=/etc/jarvis/remote-operator.env
DROPIN=/etc/systemd/system/jarvis-remote-operator.service.d/zzzzzzzzzzzzzzzzzzzz-owner-chat-finalization-v3.conf
REPO_URL=https://github.com/dariolazzano3-ops/chatgpt-test.git

[[ ${EUID:-$(id -u)} -eq 0 ]] || { echo ROOT_REQUIRED; exit 10; }
[[ -d "$SRC/.git" ]] || { echo SOURCE_REPO_REQUIRED; exit 11; }
[[ "$EXPECTED_HEAD" =~ ^[0-9a-f]{40}$ ]] || { echo EXPECTED_HEAD_INVALID; exit 12; }
[[ "$(runuser -u jarvis -- git -C "$SRC" rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || { echo SOURCE_HEAD_MISMATCH; exit 13; }
[[ "$(runuser -u jarvis -- git -C "$SRC" branch --show-current)" == "$FEATURE_BRANCH" ]] || { echo SOURCE_BRANCH_MISMATCH; exit 14; }
[[ -z "$(runuser -u jarvis -- git -C "$SRC" status --porcelain)" ]] || { echo SOURCE_DIRTY; exit 15; }
[[ -f "$ENV" ]] || { echo ENV_MISSING; exit 16; }
[[ -f /home/jarvis/.config/gh/hosts.yml ]] || { echo JARVIS_GITHUB_AUTH_MISSING; exit 17; }
[[ -x /usr/local/sbin/jarvis-maintenance ]] || { echo MAINTENANCE_GATE_MISSING; exit 18; }
[[ ! -e "$TARGET" ]] || { echo TARGET_ALREADY_EXISTS; exit 19; }
[[ ! -e "$RUNTIME" ]] || { echo RUNTIME_ALREADY_EXISTS; exit 20; }

SOURCE_TREE="$(runuser -u jarvis -- git -C "$SRC" rev-parse HEAD^{tree})"
[[ "$SOURCE_TREE" =~ ^[0-9a-f]{40}$ ]] || { echo SOURCE_TREE_INVALID; exit 21; }

ENV_BAK="$(mktemp /etc/jarvis/.owner-finalize-v3-env.XXXXXX)"
DROPIN_BAK="$(mktemp /etc/jarvis/.owner-finalize-v3-dropin.XXXXXX)"
GH_HOSTS_BAK="$(mktemp /etc/jarvis/.owner-finalize-v3-gh.XXXXXX)"
GITCONFIG_BAK="$(mktemp /etc/jarvis/.owner-finalize-v3-gitconfig.XXXXXX)"
CRON_BAK="$(mktemp /tmp/owner-finalize-v3-cron.XXXXXX)"
WATCHER_BAK="$(mktemp /tmp/owner-finalize-v3-watcher.XXXXXX)"
TMP="$(mktemp -d /run/jarvis-owner-finalize-v3.XXXXXX)"
DROPIN_EXISTED=0
GH_HOSTS_EXISTED=0
GITCONFIG_EXISTED=0
CRON_EXISTED=0
WATCHER_EXISTED=0
LEGACY_MOVED=0
LEGACY_ARCHIVE=""
TARGET_CREATED=0
RUNTIME_CREATED=0
QUEUE_CREATED=0
LIVE_SWITCHED=0

cp -p "$ENV" "$ENV_BAK"
if [[ -f "$DROPIN" ]]; then cp -p "$DROPIN" "$DROPIN_BAK"; DROPIN_EXISTED=1; else : >"$DROPIN_BAK"; fi
if [[ -f /opt/jarvis/.config/gh/hosts.yml ]]; then cp -p /opt/jarvis/.config/gh/hosts.yml "$GH_HOSTS_BAK"; GH_HOSTS_EXISTED=1; else : >"$GH_HOSTS_BAK"; fi
if [[ -f /opt/jarvis/.gitconfig ]]; then cp -p /opt/jarvis/.gitconfig "$GITCONFIG_BAK"; GITCONFIG_EXISTED=1; else : >"$GITCONFIG_BAK"; fi
if runuser -u jarvis -- crontab -l >"$CRON_BAK" 2>/dev/null; then CRON_EXISTED=1; else : >"$CRON_BAK"; fi
chown jarvis:jarvis "$CRON_BAK"
chmod 0600 "$CRON_BAK"
if [[ -f "$WATCHER" ]]; then cp -p "$WATCHER" "$WATCHER_BAK"; WATCHER_EXISTED=1; else : >"$WATCHER_BAK"; fi

rollback() {
  rc=$?
  trap - ERR
  echo "OWNER_FINALIZE_V3_ROLLBACK=BEGIN rc=$rc"

  cp -p "$ENV_BAK" "$ENV" || true
  if [[ "$DROPIN_EXISTED" == 1 ]]; then cp -p "$DROPIN_BAK" "$DROPIN" || true; else rm -f "$DROPIN" || true; fi

  if [[ -L "$LEGACY_PATH" ]]; then rm -f "$LEGACY_PATH" || true; fi
  if [[ "$LEGACY_MOVED" == 1 && -n "$LEGACY_ARCHIVE" && -e "$LEGACY_ARCHIVE" ]]; then
    mv "$LEGACY_ARCHIVE" "$LEGACY_PATH" || true
  fi

  if [[ "$CRON_EXISTED" == 1 ]]; then
    runuser -u jarvis -- crontab "$CRON_BAK" || true
  else
    runuser -u jarvis -- crontab -r 2>/dev/null || true
  fi
  if [[ "$WATCHER_EXISTED" == 1 ]]; then
    install -o jarvis -g jarvis -m 0750 "$WATCHER_BAK" "$WATCHER" || true
  else
    rm -f "$WATCHER" || true
  fi

  if [[ "$GH_HOSTS_EXISTED" == 1 ]]; then
    install -d -o jarvis-operator -g jarvis-operator -m 0700 /opt/jarvis/.config/gh || true
    install -o jarvis-operator -g jarvis-operator -m 0600 "$GH_HOSTS_BAK" /opt/jarvis/.config/gh/hosts.yml || true
  else
    rm -f /opt/jarvis/.config/gh/hosts.yml || true
  fi
  if [[ "$GITCONFIG_EXISTED" == 1 ]]; then
    install -o jarvis-operator -g jarvis-operator -m 0600 "$GITCONFIG_BAK" /opt/jarvis/.gitconfig || true
  else
    rm -f /opt/jarvis/.gitconfig || true
  fi

  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true

  [[ "$TARGET_CREATED" == 1 ]] && rm -rf "$TARGET" || true
  [[ "$RUNTIME_CREATED" == 1 ]] && rm -rf "$RUNTIME" || true
  [[ "$QUEUE_CREATED" == 1 ]] && rm -rf "$QUEUE" || true

  rm -rf "$TMP"
  rm -f "$ENV_BAK" "$DROPIN_BAK" "$GH_HOSTS_BAK" "$GITCONFIG_BAK" "$CRON_BAK" "$WATCHER_BAK"
  echo "OWNER_FINALIZE_V3_ROLLBACK=COMPLETE"
  exit "$rc"
}
trap rollback ERR

echo "=== 1/8 SOURCE GATES ==="
runuser -u jarvis -- bash -lc "cd '$SRC' && node --check src/jarvis/accepted-work-publisher-v1.js && node --check src/jarvis/remote-operator-server-v1.js && bash -n scripts/jarvis-owner-private-deploy-watch-v1.sh && git diff --check"
runuser -u jarvis -- bash -lc "cd '$SRC' && node scripts/jarvis-owner-chat-auto-finalization-v1-smoke.mjs"
runuser -u jarvis -- bash -lc "cd '$SRC' && node scripts/jarvis-owner-chat-job-v1-smoke.mjs"
runuser -u jarvis -- bash -lc "cd '$SRC' && node scripts/jarvis-remote-operator-server-v1-smoke.mjs"
runuser -u jarvis -- bash -lc "cd '$SRC' && node scripts/jarvis-command-center-autonomy-v1-smoke.mjs"
echo SOURCE_GATES=PASS

echo "=== 2/8 CLEAN OWNER WORKSPACE + RUNTIME ==="
git clone --quiet --no-hardlinks "$SRC" "$TARGET"
TARGET_CREATED=1
[[ "$(git -c safe.directory="$TARGET" -C "$TARGET" rev-parse HEAD)" == "$EXPECTED_HEAD" ]]
[[ "$(git -c safe.directory="$TARGET" -C "$TARGET" branch --show-current)" == "$FEATURE_BRANCH" ]]
git -c safe.directory="$TARGET" -C "$TARGET" remote remove origin
git -c safe.directory="$TARGET" -C "$TARGET" remote add github "$REPO_URL"
chown -R 11000:11000 "$TARGET"
chmod -R g+rwX "$TARGET"
find "$TARGET" -type d -exec chmod g+s {} +

git clone --quiet --no-hardlinks "$SRC" "$RUNTIME"
RUNTIME_CREATED=1
git -c safe.directory="$RUNTIME" -C "$RUNTIME" branch -M "$RUNTIME_BRANCH"
git -c safe.directory="$RUNTIME" -C "$RUNTIME" remote remove origin
[[ "$(git -c safe.directory="$RUNTIME" -C "$RUNTIME" rev-parse HEAD)" == "$EXPECTED_HEAD" ]]
[[ "$(git -c safe.directory="$RUNTIME" -C "$RUNTIME" branch --show-current)" == "$RUNTIME_BRANCH" ]]
chown -R jarvis-operator:jarvis-operator "$RUNTIME"

install -d -o jarvis-operator -g jarvis-worker -m 2770 "$MOUNT"
[[ -z "$(find "$MOUNT" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]] || { echo OWNER_MOUNT_NOT_EMPTY; false; }

install -d -o jarvis-operator -g jarvis -m 2770 "$QUEUE"
QUEUE_CREATED=1
install -d -o jarvis-operator -g jarvis -m 2770 "$RESULTS"

BRIDGE_MATCH=0
for BP in $(pgrep -f 'python3 /opt/jarvis-bridge/bridge.py' || true); do
  if nsenter -t "$BP" -m -- test -d "/workspace/projects/$PROJECT/.git" 2>/dev/null; then
    BRIDGE_MATCH=1
    break
  fi
done
[[ "$BRIDGE_MATCH" == 1 ]] || { echo BRIDGE_PROJECT_NOT_VISIBLE; false; }
echo OWNER_WORKSPACE_AND_RUNTIME=PASS

echo "=== 3/8 GITHUB WRITE AUTH ==="
install -d -o jarvis-operator -g jarvis-operator -m 0700 /opt/jarvis/.config/gh
install -o jarvis-operator -g jarvis-operator -m 0600 /home/jarvis/.config/gh/hosts.yml /opt/jarvis/.config/gh/hosts.yml
if ! runuser -u jarvis-operator -- env HOME=/opt/jarvis XDG_CONFIG_HOME=/opt/jarvis/.config /usr/bin/gh auth setup-git --hostname github.com >/dev/null 2>&1; then
  runuser -u jarvis-operator -- env HOME=/opt/jarvis XDG_CONFIG_HOME=/opt/jarvis/.config /usr/bin/git config --global credential.https://github.com.helper '!/usr/bin/gh auth git-credential'
fi
runuser -u jarvis-operator -- env HOME=/opt/jarvis XDG_CONFIG_HOME=/opt/jarvis/.config /usr/bin/gh auth status -h github.com >/dev/null
runuser -u jarvis-operator -- env HOME=/opt/jarvis XDG_CONFIG_HOME=/opt/jarvis/.config /usr/bin/git -c safe.directory="$TARGET" -C "$TARGET" push --dry-run github "HEAD:$FEATURE_BRANCH" >/dev/null
echo GITHUB_WRITE_AUTH=PASS

echo "=== 4/8 PRIVATE RUNTIME PREFLIGHT ==="
PRE_JS='import("./src/jarvis/remote-operator-server-v1.js").then(async m=>{const r=await m.startJarvisRemoteOperatorV1(process.env); console.log("PREFLIGHT_RUNTIME_OK="+String(r.ok)); if(!r.ok){console.log("PREFLIGHT_RUNTIME_ERROR="+String(r.error||"UNKNOWN"));process.exit(1);} if(r.server) await new Promise(x=>r.server.close(x));process.exit(0);}).catch(e=>{console.error("PREFLIGHT_RUNTIME_EXCEPTION="+String(e&&e.message||e));process.exit(1);});'
PRE_UNIT="jarvis-owner-finalize-v3-preflight-$$"
/usr/bin/systemd-run --quiet --wait --pipe --collect   --unit="$PRE_UNIT"   --uid=jarvis-operator   -p ProtectHome=yes   -p ProtectSystem=strict   -p PrivateTmp=yes   -p NoNewPrivileges=yes   -p "BindPaths=$TARGET:$MOUNT:rbind"   -p "ReadWritePaths=$RUNTIME"   -p "ReadWritePaths=$MOUNT"   -p "ReadWritePaths=$QUEUE"   -p "ReadOnlyPaths=/etc/jarvis"   -p "EnvironmentFile=$ENV"   -p "WorkingDirectory=$RUNTIME"   -- /usr/bin/env     HOME=/opt/jarvis     XDG_CONFIG_HOME=/opt/jarvis/.config     JARVIS_REMOTE_PORT=8790     JARVIS_CLAUDE_REPO_DIR="$MOUNT"     JARVIS_BRIDGE_PROJECT="$PROJECT"     JARVIS_PROGRAM_RUNNER_ENABLED=off     JARVIS_PROGRAM_RUNNER_AUTO_START=off     JARVIS_OWNER_CHAT_AUTO_FINALIZE=on     JARVIS_PROJECT_MISSION_AURENTARA_ENABLED=off     GIT_CONFIG_COUNT=1     GIT_CONFIG_KEY_0=safe.directory     GIT_CONFIG_VALUE_0="$MOUNT"     /usr/bin/node -e "$PRE_JS"
echo PRIVATE_RUNTIME_PREFLIGHT=PASS

echo "=== 5/8 REUSE EXISTING MAINTENANCE GATE ==="
if [[ -L "$LEGACY_PATH" ]]; then
  echo LEGACY_RUNTIME_ALREADY_SYMLINKED
elif [[ -e "$LEGACY_PATH" ]]; then
  LEGACY_ARCHIVE="/opt/jarvis/chatgpt-test-pre-owner-v3-$(date +%Y%m%d%H%M%S)"
  mv "$LEGACY_PATH" "$LEGACY_ARCHIVE"
  LEGACY_MOVED=1
fi
ln -sfn "$RUNTIME" "$LEGACY_PATH"

install -d -o jarvis -g jarvis -m 0750 /home/jarvis/.local/bin
install -o jarvis -g jarvis -m 0750 "$SRC/scripts/jarvis-owner-private-deploy-watch-v1.sh" "$WATCHER"

CRON_NEW="$(mktemp /tmp/jarvis-owner-finalize-v3-crontab.XXXXXX)"
cat "$CRON_BAK" >"$CRON_NEW"
grep -v 'jarvis-owner-private-deploy-watch-v1.sh' "$CRON_NEW" >"$CRON_NEW.clean" || true
mv "$CRON_NEW.clean" "$CRON_NEW"
printf '%s\n' '* * * * * /home/jarvis/.local/bin/jarvis-owner-private-deploy-watch-v1.sh >>/home/jarvis/.jarvis-owner-deploy-watch.log 2>&1' >>"$CRON_NEW"
chown jarvis:jarvis "$CRON_NEW"
chmod 0600 "$CRON_NEW"
runuser -u jarvis -- crontab "$CRON_NEW"
rm -f "$CRON_NEW"

runuser -u jarvis -- sudo -n /usr/local/sbin/jarvis-maintenance status >/dev/null
echo EXISTING_MAINTENANCE_GATE_REUSED=PASS

echo "=== 6/8 LIVE OWNER RUNTIME SWITCH ==="
awk '!/^(JARVIS_CLAUDE_REPO_DIR|JARVIS_BRIDGE_PROJECT|JARVIS_PROGRAM_RUNNER_ENABLED|JARVIS_PROGRAM_RUNNER_AUTO_START|JARVIS_OWNER_CHAT_AUTO_FINALIZE|JARVIS_PROJECT_MISSION_AURENTARA_ENABLED)=/' "$ENV_BAK" >"$TMP/env.new"
{
  printf '%s\n' "JARVIS_CLAUDE_REPO_DIR=$MOUNT"
  printf '%s\n' "JARVIS_BRIDGE_PROJECT=$PROJECT"
  printf '%s\n' "JARVIS_PROGRAM_RUNNER_ENABLED=off"
  printf '%s\n' "JARVIS_PROGRAM_RUNNER_AUTO_START=off"
  printf '%s\n' "JARVIS_OWNER_CHAT_AUTO_FINALIZE=on"
  printf '%s\n' "JARVIS_PROJECT_MISSION_AURENTARA_ENABLED=off"
} >>"$TMP/env.new"
chown --reference="$ENV" "$TMP/env.new"
chmod --reference="$ENV" "$TMP/env.new"
mv "$TMP/env.new" "$ENV"

cat >"$DROPIN" <<EOF
[Service]
WorkingDirectory=$RUNTIME
BindPaths=$TARGET:$MOUNT:rbind
ReadWritePaths=$RUNTIME
ReadWritePaths=$MOUNT
ReadWritePaths=$QUEUE
Environment=HOME=/opt/jarvis
Environment=XDG_CONFIG_HOME=/opt/jarvis/.config
Environment=GIT_CONFIG_COUNT=1
Environment=GIT_CONFIG_KEY_0=safe.directory
Environment=GIT_CONFIG_VALUE_0=$MOUNT
EOF
chmod 0644 "$DROPIN"
systemctl daemon-reload
systemctl restart "$SERVICE"
LIVE_SWITCHED=1

HTTP=""
for _ in $(seq 1 30); do
  if systemctl is-active --quiet "$SERVICE"; then
    HTTP="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:8788/ 2>/dev/null || true)"
    [[ "$HTTP" == 401 ]] && break
  fi
  sleep 1
done
[[ "$HTTP" == 401 ]] || { echo "LIVE_HTTP_FAIL=${HTTP:-none}"; false; }

PID="$(systemctl show "$SERVICE" -p MainPID --value)"
[[ "$PID" =~ ^[0-9]+$ && "$PID" -gt 1 ]]
[[ "$(readlink -f "/proc/$PID/cwd")" == "$RUNTIME" ]]
tr '\0' '\n' <"/proc/$PID/environ" | grep -qx "JARVIS_CLAUDE_REPO_DIR=$MOUNT"
tr '\0' '\n' <"/proc/$PID/environ" | grep -qx "JARVIS_BRIDGE_PROJECT=$PROJECT"
tr '\0' '\n' <"/proc/$PID/environ" | grep -qx "JARVIS_PROGRAM_RUNNER_ENABLED=off"
tr '\0' '\n' <"/proc/$PID/environ" | grep -qx "JARVIS_OWNER_CHAT_AUTO_FINALIZE=on"
tr '\0' '\n' <"/proc/$PID/environ" | grep -qx "JARVIS_PROJECT_MISSION_AURENTARA_ENABLED=off"

OWNER_HEAD_LIVE="$(nsenter -t "$PID" -m -- /usr/sbin/runuser -u jarvis-operator -- /usr/bin/git -c safe.directory="$MOUNT" -C "$MOUNT" rev-parse HEAD)"
OWNER_STATUS_LIVE="$(nsenter -t "$PID" -m -- /usr/sbin/runuser -u jarvis-operator -- /usr/bin/git -c safe.directory="$MOUNT" -C "$MOUNT" status --porcelain)"
[[ "$OWNER_HEAD_LIVE" == "$EXPECTED_HEAD" ]]
[[ -z "$OWNER_STATUS_LIVE" ]]
runuser -u jarvis-operator -- env HOME=/opt/jarvis XDG_CONFIG_HOME=/opt/jarvis/.config /usr/bin/git -c safe.directory="$TARGET" -C "$TARGET" push --dry-run github "HEAD:$FEATURE_BRANCH" >/dev/null
runuser -u jarvis -- "$WATCHER" --self-test >/dev/null
echo LIVE_OWNER_RUNTIME=PASS

echo "=== 7/8 REAL PRIVATE MAINTENANCE SMOKE ==="
SMOKE_ID="bootstrap-live-smoke-$(date +%Y%m%d%H%M%S)"
SMOKE_STAGE="$(mktemp -d "$TMP/smoke.XXXXXX")"
mkdir -p "$SMOKE_STAGE/payload/scripts"
cp "$RUNTIME/scripts/jarvis-owner-chat-auto-finalization-v1-smoke.mjs" "$SMOKE_STAGE/payload/scripts/jarvis-owner-chat-auto-finalization-v1-smoke.mjs"
printf '\n// owner private deploy gate live smoke %s\n' "$SMOKE_ID" >>"$SMOKE_STAGE/payload/scripts/jarvis-owner-chat-auto-finalization-v1-smoke.mjs"
SMOKE_SHA="$(sha256sum "$SMOKE_STAGE/payload/scripts/jarvis-owner-chat-auto-finalization-v1-smoke.mjs" | awk '{print $1}')"
RUNTIME_HEAD_BEFORE="$(runuser -u jarvis-operator -- git -C "$RUNTIME" rev-parse HEAD)"
cat >"$SMOKE_STAGE/manifest.json" <<EOF
{
  "checks": ["scripts/jarvis-owner-chat-auto-finalization-v1-smoke.mjs"],
  "commit_message": "chore(jarvis): verify owner private deploy gate",
  "expected_head": "$RUNTIME_HEAD_BEFORE",
  "files": [
    {
      "path": "scripts/jarvis-owner-chat-auto-finalization-v1-smoke.mjs",
      "sha256": "$SMOKE_SHA"
    }
  ],
  "schema": "jarvis-maintenance-bundle.v1",
  "target_branch": "$RUNTIME_BRANCH"
}
EOF
tar -czf "$SMOKE_STAGE/pending.tgz" -C "$SMOKE_STAGE" manifest.json payload
cat >"$SMOKE_STAGE/pending.json" <<EOF
{
  "schema": "aurentara.jarvis.owner-private-deploy-request.v1",
  "request_id": "$SMOKE_ID",
  "source_commit": "$EXPECTED_HEAD",
  "source_tree": "$SOURCE_TREE",
  "source_branch": "$FEATURE_BRANCH",
  "runtime_expected_head": "$RUNTIME_HEAD_BEFORE",
  "runtime_branch": "$RUNTIME_BRANCH"
}
EOF
install -o jarvis-operator -g jarvis -m 0660 "$SMOKE_STAGE/pending.tgz" "$QUEUE/pending.tgz"
install -o jarvis-operator -g jarvis -m 0660 "$SMOKE_STAGE/pending.json" "$QUEUE/pending.json"
runuser -u jarvis -- "$WATCHER"
RESULT="$RESULTS/$SMOKE_ID.json"
[[ -f "$RESULT" ]]
python3 - "$RESULT" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as f:
    d=json.load(f)
assert d.get("status")=="DEPLOYED", d
assert d.get("runtime_commit"), d
print("PRIVATE_MAINTENANCE_RESULT=DEPLOYED")
PY
systemctl is-active --quiet "$SERVICE"
[[ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:8788/ 2>/dev/null || true)" == 401 ]]
runuser -u jarvis -- sudo -n /usr/local/sbin/jarvis-maintenance status >/dev/null
echo REAL_PRIVATE_MAINTENANCE_SMOKE=PASS

echo "=== 8/8 FINAL TRUTH ==="
FINAL_PID="$(systemctl show "$SERVICE" -p MainPID --value)"
FINAL_RUNTIME_HEAD="$(runuser -u jarvis-operator -- git -C "$RUNTIME" rev-parse HEAD)"
FINAL_OWNER_HEAD="$(nsenter -t "$FINAL_PID" -m -- /usr/sbin/runuser -u jarvis-operator -- /usr/bin/git -c safe.directory="$MOUNT" -C "$MOUNT" rev-parse HEAD)"
[[ "$FINAL_OWNER_HEAD" == "$EXPECTED_HEAD" ]]
[[ -z "$(runuser -u jarvis-operator -- git -C "$RUNTIME" status --porcelain)" ]]
[[ "$(systemctl is-active "$SERVICE")" == active ]]
[[ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:8788/ 2>/dev/null || true)" == 401 ]]

echo "OWNER_SOURCE_HEAD=$FINAL_OWNER_HEAD"
echo "PRIVATE_RUNTIME_HEAD=$FINAL_RUNTIME_HEAD"
echo "JARVIS_SERVICE=active"
echo "JARVIS_PRIVATE_HTTP=401"
echo "GITHUB_PUSH_AUTH=PASS"
echo "PRIVATE_DEPLOY_GATE=PASS"
echo "ROLLBACK_GATE=ARMED_BY_EXISTING_MAINTENANCE"
echo "PUBLIC_PRODUCTION_DNS_BILLING=UNCHANGED"
echo "JARVIS_OWNER_AUTO_FINALIZATION_V3=PASS"

trap - ERR
rm -rf "$TMP"
rm -f "$ENV_BAK" "$DROPIN_BAK" "$GH_HOSTS_BAK" "$GITCONFIG_BAK" "$CRON_BAK" "$WATCHER_BAK"

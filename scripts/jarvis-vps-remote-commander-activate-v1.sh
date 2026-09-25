#!/usr/bin/env bash
set -Eeuo pipefail

VERSION="0.2.51"
ENTRY="/opt/desktop-commander-remote/node_modules/@wonderwhy-er/desktop-commander/dist/index.js"
PKG="/opt/desktop-commander-remote/node_modules/@wonderwhy-er/desktop-commander/package.json"
SERVICE="desktop-commander-vps.service"
STATE="/home/jarvis/.desktop-commander-device/device.json"

fail() {
  echo "DESKTOP_COMMANDER_VPS_ACTIVATION=FAIL"
  echo "FAILURE_REASON=$1"
  exit "\${2:-1}"
}

[[ "$(id -un)" == "jarvis" ]] || fail "RUN_AS_JARVIS_REQUIRED" 10
sudo -v

[[ -f "$ENTRY" ]] || fail "ENTRY_MISSING" 11
[[ -f "$PKG" ]] || fail "PACKAGE_METADATA_MISSING" 12
[[ "$(node -p "require('$PKG').version")" == "$VERSION" ]] || fail "PACKAGE_VERSION_MISMATCH" 13
[[ -f "$STATE" ]] || fail "PAIRING_STATE_MISSING_RUN_INTERACTIVE_PAIRING_FIRST" 14

OWNER="$(stat -c '%U:%G' "$STATE")"
MODE="$(stat -c '%a' "$STATE")"
[[ "$OWNER" == "jarvis:jarvis" ]] || fail "PAIRING_STATE_OWNER_MISMATCH:$OWNER" 15
case "$MODE" in
  600|640|644) ;;
  *) fail "PAIRING_STATE_MODE_UNEXPECTED:$MODE" 16 ;;
esac

sudo systemctl enable --now "$SERVICE"

for _ in $(seq 1 30); do
  if sudo systemctl is-active --quiet "$SERVICE"; then
    break
  fi
  sleep 1
done

sudo systemctl is-active --quiet "$SERVICE" || fail "SERVICE_NOT_ACTIVE" 17
sudo systemctl is-enabled --quiet "$SERVICE" || fail "SERVICE_NOT_ENABLED" 18

PID="$(sudo systemctl show "$SERVICE" -p MainPID --value)"
[[ "$PID" =~ ^[0-9]+$ && "$PID" -gt 1 ]] || fail "SERVICE_PID_INVALID" 19

echo "DESKTOP_COMMANDER_VERSION=$VERSION"
echo "SERVICE=$SERVICE"
echo "SERVICE_STATE=active"
echo "SERVICE_ENABLED=yes"
echo "SERVICE_PID=$PID"
echo "PAIRING_STATE_PRESENT=yes"
echo "RECENT_LOGS_BEGIN"
sudo journalctl -u "$SERVICE" -n 30 --no-pager | sed -E 's/(access_token|refresh_token|token)[=:][^ ]+/\1=[REDACTED]/Ig'
echo "RECENT_LOGS_END"
echo "DESKTOP_COMMANDER_VPS_ACTIVATION=PASS"

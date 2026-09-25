#!/usr/bin/env bash
set -Eeuo pipefail

SERVICE="desktop-commander-vps.service"
PKG="/opt/desktop-commander-remote/node_modules/@wonderwhy-er/desktop-commander/package.json"
STATE="/home/jarvis/.desktop-commander-device/device.json"

sudo systemctl is-active --quiet "$SERVICE"
sudo systemctl is-enabled --quiet "$SERVICE"
test -f "$PKG"
test -f "$STATE"

echo "DESKTOP_COMMANDER_VERSION=$(node -p "require('$PKG').version")"
echo "SERVICE_STATE=$(sudo systemctl is-active "$SERVICE")"
echo "SERVICE_ENABLED=$(sudo systemctl is-enabled "$SERVICE")"
echo "STATE_OWNER=$(stat -c '%U:%G' "$STATE")"
echo "STATE_MODE=$(stat -c '%a' "$STATE")"
echo "DESKTOP_COMMANDER_VPS_VERIFY=PASS"

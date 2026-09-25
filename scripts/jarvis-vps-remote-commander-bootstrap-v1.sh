#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

VERSION="0.2.51"
INSTALL_ROOT="/opt/desktop-commander-remote"
PKG_ROOT="$INSTALL_ROOT/node_modules/@wonderwhy-er/desktop-commander"
ENTRY="$PKG_ROOT/dist/index.js"
SERVICE="/etc/systemd/system/desktop-commander-vps.service"
STATE_DIR="/home/jarvis/.desktop-commander-device"

fail() {
  echo "DESKTOP_COMMANDER_VPS_BOOTSTRAP=FAIL"
  echo "FAILURE_REASON=$1"
  exit "\${2:-1}"
}

[[ "$(id -un)" == "jarvis" ]] || fail "RUN_AS_JARVIS_REQUIRED" 10
command -v node >/dev/null 2>&1 || fail "NODE_MISSING" 11
command -v npm >/dev/null 2>&1 || fail "NPM_MISSING" 12

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
[[ "$NODE_MAJOR" -ge 18 ]] || fail "NODE_TOO_OLD:$(node -v)" 13

sudo -v

echo "NODE_VERSION=$(node -v)"
echo "NPM_VERSION=$(npm -v)"

sudo install -d -o root -g root -m 0755 "$INSTALL_ROOT"

TMP="$(mktemp -d /tmp/desktop-commander-vps-bootstrap.XXXXXX)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

cat >"$TMP/package.json" <<EOF
{
  "name": "jarvis-vps-remote-commander-runtime",
  "private": true,
  "version": "1.0.0",
  "dependencies": {
    "@wonderwhy-er/desktop-commander": "$VERSION"
  }
}
EOF

(
  cd "$TMP"
  npm install --omit=dev --no-audit --no-fund --ignore-scripts >/dev/null
)

[[ -f "$TMP/node_modules/@wonderwhy-er/desktop-commander/dist/index.js" ]] || fail "PACKAGE_ENTRY_MISSING" 14
INSTALLED_VERSION="$(node -p "require('$TMP/node_modules/@wonderwhy-er/desktop-commander/package.json').version")"
[[ "$INSTALLED_VERSION" == "$VERSION" ]] || fail "PACKAGE_VERSION_MISMATCH:$INSTALLED_VERSION" 15

sudo rm -rf "$INSTALL_ROOT/node_modules" "$INSTALL_ROOT/package.json" "$INSTALL_ROOT/package-lock.json"
sudo cp -a "$TMP/node_modules" "$INSTALL_ROOT/"
sudo cp "$TMP/package.json" "$INSTALL_ROOT/package.json"
[[ -f "$TMP/package-lock.json" ]] && sudo cp "$TMP/package-lock.json" "$INSTALL_ROOT/package-lock.json"
sudo chown -R root:root "$INSTALL_ROOT"

sudo install -d -o jarvis -g jarvis -m 0700 "$STATE_DIR"

cat >"$TMP/desktop-commander-vps.service" <<EOF
[Unit]
Description=Remote Desktop Commander - JARVIS VPS
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=jarvis
Group=jarvis
Environment=HOME=/home/jarvis
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
WorkingDirectory=/home/jarvis
ExecStart=/usr/bin/node $ENTRY remote
Restart=always
RestartSec=10
KillSignal=SIGTERM
TimeoutStopSec=20
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo install -o root -g root -m 0644 "$TMP/desktop-commander-vps.service" "$SERVICE"
sudo systemctl daemon-reload
sudo systemctl disable --now desktop-commander-vps.service >/dev/null 2>&1 || true

echo "DESKTOP_COMMANDER_VERSION=$VERSION"
echo "DESKTOP_COMMANDER_ENTRY=$ENTRY"
echo "PAIRING_STATE_DIR=$STATE_DIR"
echo "SERVICE_NAME=desktop-commander-vps.service"
echo "PAIR_COMMAND=/usr/bin/node $ENTRY remote"
echo "DESKTOP_COMMANDER_VPS_BOOTSTRAP=READY_FOR_PAIRING"

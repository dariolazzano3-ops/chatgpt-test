#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

VERSION="0.2.51"
INSTALL_ROOT="/opt/desktop-commander-remote"
PKG="$INSTALL_ROOT/node_modules/@wonderwhy-er/desktop-commander/package.json"
ENTRY="$INSTALL_ROOT/node_modules/@wonderwhy-er/desktop-commander/dist/index.js"
SERVICE="/etc/systemd/system/desktop-commander-vps.service"
STATE_DIR="/home/jarvis/.desktop-commander-device"

fail() {
  echo "DESKTOP_COMMANDER_VPS_BOOTSTRAP=FAIL"
  echo "FAILURE_REASON=$1"
  exit "\${2:-1}"
}

[[ "$(id -un)" == "jarvis" ]] || fail "RUN_AS_JARVIS_REQUIRED" 10
NODE_BIN="$(command -v node || true)"
NPM_BIN="$(command -v npm || true)"
[[ -n "$NODE_BIN" ]] || fail "NODE_MISSING" 11
[[ -n "$NPM_BIN" ]] || fail "NPM_MISSING" 12

NODE_MAJOR="$("$NODE_BIN" -p 'Number(process.versions.node.split(".")[0])')"
[[ "$NODE_MAJOR" -ge 18 ]] || fail "NODE_TOO_OLD:$("$NODE_BIN" -v)" 13

sudo -v

echo "NODE_BIN=$NODE_BIN"
echo "NODE_VERSION=$("$NODE_BIN" -v)"
echo "NPM_BIN=$NPM_BIN"
echo "NPM_VERSION=$("$NPM_BIN" -v)"

sudo rm -rf "$INSTALL_ROOT"
sudo install -d -o root -g root -m 0755 "$INSTALL_ROOT"

sudo "$NPM_BIN" install \
  --prefix "$INSTALL_ROOT" \
  --omit=dev \
  --no-audit \
  --no-fund \
  "@wonderwhy-er/desktop-commander@$VERSION"

sudo test -f "$PKG" || fail "TARGET_PACKAGE_METADATA_MISSING" 14
sudo test -f "$ENTRY" || fail "TARGET_ENTRY_MISSING_AFTER_INSTALL" 15

INSTALLED_VERSION="$(sudo "$NODE_BIN" -p "require('$PKG').version")"
[[ "$INSTALLED_VERSION" == "$VERSION" ]] || fail "PACKAGE_VERSION_MISMATCH:$INSTALLED_VERSION" 16

sudo chown -R root:root "$INSTALL_ROOT"
sudo install -d -o jarvis -g jarvis -m 0700 "$STATE_DIR"

TMP="$(mktemp -d /tmp/desktop-commander-vps-service.XXXXXX)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

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
ExecStart=$NODE_BIN $ENTRY remote
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
echo "DESKTOP_COMMANDER_ENTRY_PRESENT=yes"
echo "PAIRING_STATE_DIR=$STATE_DIR"
echo "SERVICE_NAME=desktop-commander-vps.service"
echo "PAIR_COMMAND=$NODE_BIN $ENTRY remote"
echo "DESKTOP_COMMANDER_VPS_BOOTSTRAP=READY_FOR_PAIRING"

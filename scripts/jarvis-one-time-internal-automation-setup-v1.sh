#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SRC="${1:-}"
EXPECTED_HEAD="${2:-}"
BRANCH=factory/jarvis-owner-chat-auto-finalize-v1
SUDOERS=/etc/sudoers.d/jarvis-internal-automation-v1
MAINT=/usr/local/sbin/jarvis-maintenance
FINALIZER=/usr/local/sbin/jarvis-owner-finalize-v3

[[ ${EUID:-$(id -u)} -eq 0 ]] || { echo ROOT_REQUIRED; exit 10; }
[[ -d "$SRC/.git" ]] || { echo SOURCE_REPO_REQUIRED; exit 11; }
[[ "$EXPECTED_HEAD" =~ ^[0-9a-f]{40}$ ]] || { echo EXPECTED_HEAD_INVALID; exit 12; }
[[ "$(runuser -u jarvis -- git -C "$SRC" rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || { echo SOURCE_HEAD_MISMATCH; exit 13; }
[[ "$(runuser -u jarvis -- git -C "$SRC" branch --show-current)" == "$BRANCH" ]] || { echo SOURCE_BRANCH_MISMATCH; exit 14; }

[[ -x "$MAINT" ]] || { echo MAINTENANCE_HELPER_MISSING; exit 15; }
[[ "$(stat -c %u "$MAINT")" == 0 ]] || { echo MAINTENANCE_HELPER_NOT_ROOT_OWNED; exit 16; }
MODE="$(stat -c %a "$MAINT")"
case "$MODE" in
  *2|*3|*6|*7) echo MAINTENANCE_HELPER_WRITABLE_BY_NONROOT; exit 17 ;;
esac

install -o root -g root -m 0755 "$SRC/scripts/jarvis-owner-auto-finalization-bootstrap-v3.sh" "$FINALIZER"

TMP="$(mktemp /etc/sudoers.d/.jarvis-internal-automation-v1.XXXXXX)"
cat >"$TMP" <<'EOF'
# JARVIS private/internal maintenance only.
# No shell, no arbitrary systemctl, no editor, no production/public/DNS/billing actions.
jarvis ALL=(root) NOPASSWD: /usr/local/sbin/jarvis-maintenance install
jarvis ALL=(root) NOPASSWD: /usr/local/sbin/jarvis-maintenance restart
jarvis ALL=(root) NOPASSWD: /usr/local/sbin/jarvis-maintenance status
jarvis ALL=(root) NOPASSWD: /usr/local/sbin/jarvis-owner-finalize-v3 /tmp/jarvis-owner-finalize-v3-src *
EOF
chmod 0440 "$TMP"
/usr/sbin/visudo -cf "$TMP" >/dev/null
mv -f "$TMP" "$SUDOERS"
chmod 0440 "$SUDOERS"
/usr/sbin/visudo -cf /etc/sudoers >/dev/null

runuser -u jarvis -- sudo -n /usr/local/sbin/jarvis-maintenance status >/dev/null
runuser -u jarvis -- sudo -n "$FINALIZER" "$SRC" "$EXPECTED_HEAD" --help >/dev/null 2>&1 || true
echo JARVIS_NARROW_NOPASSWD=PASS

exec "$FINALIZER" "$SRC" "$EXPECTED_HEAD"

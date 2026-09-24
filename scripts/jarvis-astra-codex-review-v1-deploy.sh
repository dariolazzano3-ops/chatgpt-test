#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SRC="${1:-}"
EXPECTED_SOURCE_HEAD="${2:-}"
SOURCE_BRANCH=factory/jarvis-astra-codex-review-v1
TARGET_BRANCH=factory/jarvis-capability-expansion-v3
MAINT=/usr/local/sbin/jarvis-maintenance
INBOX=/home/jarvis/.jarvis-maintenance/pending.tgz

fail() {
  echo "ASTRA_CODEX_REVIEW_DEPLOY=FAIL"
  echo "FAILURE_REASON=$1"
  exit "${2:-1}"
}

[[ "$(id -un)" == "jarvis" ]] || fail "ASTRA_DEPLOY_USER_MISMATCH" 10
[[ -d "$SRC/.git" ]] || fail "SOURCE_REPO_REQUIRED" 11
[[ "$EXPECTED_SOURCE_HEAD" =~ ^[0-9a-f]{40}$ ]] || fail "SOURCE_HEAD_INVALID" 12
[[ "$(git -C "$SRC" rev-parse HEAD)" == "$EXPECTED_SOURCE_HEAD" ]] || fail "SOURCE_HEAD_MISMATCH" 13
[[ "$(git -C "$SRC" branch --show-current)" == "$SOURCE_BRANCH" ]] || fail "SOURCE_BRANCH_MISMATCH" 14
[[ -z "$(git -C "$SRC" status --porcelain)" ]] || fail "SOURCE_DIRTY" 15
[[ -x "$MAINT" ]] || fail "MAINTENANCE_HELPER_MISSING" 16

STATUS_BEFORE="$(sudo -n "$MAINT" status)"
printf '%s\n' "$STATUS_BEFORE"
printf '%s\n' "$STATUS_BEFORE" | grep -Fq "$TARGET_BRANCH" || fail "RUNTIME_BRANCH_MISMATCH" 18

RUNTIME_HEAD="$(printf '%s\n' "$STATUS_BEFORE" | sed -nE 's/.*[Hh][Ee][Aa][Dd][=: ]+([0-9a-f]{40}).*/\1/p' | head -1)"
if [[ ! "$RUNTIME_HEAD" =~ ^[0-9a-f]{40}$ ]]; then
  RUNTIME_HEAD="$(printf '%s\n' "$STATUS_BEFORE" | grep -Eo '[0-9a-f]{40}' | head -1 || true)"
fi
[[ "$RUNTIME_HEAD" =~ ^[0-9a-f]{40}$ ]] || fail "RUNTIME_HEAD_UNRESOLVED" 19

printf '%s\n' "$STATUS_BEFORE" | grep -Eq 'DIRTY_LINES=0|DIRTY=0|WORKTREE_CLEAN=(true|yes|1)' \
  || fail "RUNTIME_NOT_PROVEN_CLEAN" 20
printf '%s\n' "$STATUS_BEFORE" | grep -Eqi 'SERVICE_HEALTH=active(/401)?|SERVICE=active|active/401' \
  || fail "RUNTIME_SERVICE_NOT_PROVEN_HEALTHY" 21

# A failed maintenance attempt may leave pending.tgz after the helper already
# rolled the runtime back. Recover ONLY a stale bundle that is unambiguously
# this Astra deploy against the exact current runtime head.
if [[ -e "$INBOX" ]]; then
  if pgrep -af '/usr/local/sbin/jarvis-maintenance[[:space:]]+install' >/dev/null 2>&1; then
    fail "MAINTENANCE_INBOX_BUSY_ACTIVE_INSTALL" 17
  fi

  STALE_STAGE="$(mktemp -d /tmp/jarvis-astra-stale-inbox.XXXXXX)"
  cleanup_stale() { rm -rf "$STALE_STAGE"; }
  trap cleanup_stale RETURN

  tar -xzf "$INBOX" -C "$STALE_STAGE" manifest.json 2>/dev/null \
    || fail "MAINTENANCE_INBOX_BUSY_UNREADABLE" 17

  python3 - "$STALE_STAGE/manifest.json" "$TARGET_BRANCH" "$RUNTIME_HEAD" <<'PY' \
    || fail "MAINTENANCE_INBOX_BUSY_FOREIGN" 17
import json,sys
p,branch,head=sys.argv[1:]
with open(p,encoding='utf-8') as f:
    d=json.load(f)
assert d.get("schema")=="jarvis-maintenance-bundle.v1"
assert d.get("target_branch")==branch
assert d.get("expected_head")==head
assert d.get("commit_message")=="feat(jarvis): activate bounded Astra Codex review path"
PY

  rm -rf "$STALE_STAGE"
  trap - RETURN
  rm -f "$INBOX"
  echo "STALE_ASTRA_MAINTENANCE_INBOX_RECOVERED=PASS"
fi

STAGE="$(mktemp -d /tmp/jarvis-astra-codex-review-v1.XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/payload/src/jarvis" "$STAGE/payload/scripts"

# Payload == real runtime diff only. Existing regression tests remain checks,
# but identical files are not declared as changed runtime files.
FILES=(
  src/jarvis/intelligence-router-v1.js
  src/jarvis/owner-chat-job-v1.js
  src/jarvis/http-v1.js
  scripts/jarvis-astra-codex-post-review-v1-smoke.mjs
  scripts/jarvis-astra-http-flag-v1-smoke.mjs
)

for rel in "${FILES[@]}"; do
  [[ -f "$SRC/$rel" ]] || fail "SOURCE_FILE_MISSING:$rel" 22
  install -D -m 0644 "$SRC/$rel" "$STAGE/payload/$rel"
done

python3 - "$STAGE" "$RUNTIME_HEAD" "$TARGET_BRANCH" <<'PY'
import hashlib,json,pathlib,sys
stage=pathlib.Path(sys.argv[1])
head=sys.argv[2]
branch=sys.argv[3]
files=[]
for p in sorted((stage/"payload").rglob("*")):
    if p.is_file():
        rel=str(p.relative_to(stage/"payload"))
        files.append({"path":rel,"sha256":hashlib.sha256(p.read_bytes()).hexdigest()})
manifest={
    "schema":"jarvis-maintenance-bundle.v1",
    "target_branch":branch,
    "expected_head":head,
    "commit_message":"feat(jarvis): activate bounded Astra Codex review path",
    "files":files,
    "checks":[
        "scripts/jarvis-intelligence-router-v1-smoke.mjs",
        "scripts/jarvis-owner-chat-intelligence-v1-smoke.mjs",
        "scripts/jarvis-astra-codex-post-review-v1-smoke.mjs",
        "scripts/jarvis-astra-http-flag-v1-smoke.mjs",
        "scripts/jarvis-owner-chat-job-v1-smoke.mjs",
        "scripts/jarvis-hermes-core-integration-v1-smoke.mjs"
    ]
}
(stage/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
PY

tar -czf "$STAGE/pending.tgz" -C "$STAGE" manifest.json payload
install -d -m 0700 /home/jarvis/.jarvis-maintenance
install -m 0600 "$STAGE/pending.tgz" "$INBOX"

set +e
OUT="$(sudo -n "$MAINT" install 2>&1)"
RC=$?
set -e
printf '%s\n' "$OUT"

if [[ $RC -ne 0 ]] || ! printf '%s\n' "$OUT" | grep -q '^MAINTENANCE_GATE_INSTALL_PASS$'; then
  echo "ASTRA_CODEX_REVIEW_DEPLOY=FAIL"
  exit 23
fi

STATUS_AFTER="$(sudo -n "$MAINT" status)"
printf '%s\n' "$STATUS_AFTER"
printf '%s\n' "$STATUS_AFTER" | grep -Fq "$TARGET_BRANCH" || fail "POST_BRANCH_MISMATCH" 24
printf '%s\n' "$STATUS_AFTER" | grep -Eqi 'SERVICE_HEALTH=active(/401)?|SERVICE=active|active/401' \
  || fail "POST_SERVICE_NOT_ACTIVE" 25

RUNTIME=/opt/jarvis/chatgpt-test
for rel in src/jarvis/intelligence-router-v1.js src/jarvis/owner-chat-job-v1.js src/jarvis/http-v1.js; do
  sudo -n test -f "$RUNTIME/$rel" || fail "RUNTIME_FILE_MISSING:$rel" 26
  SOURCE_SHA="$(sha256sum "$SRC/$rel" | awk '{print $1}')"
  RUNTIME_SHA="$(sudo -n sha256sum "$RUNTIME/$rel" | awk '{print $1}')"
  [[ "$SOURCE_SHA" == "$RUNTIME_SHA" ]] || fail "RUNTIME_FILE_MISMATCH:$rel" 27
done

echo "SOURCE_HEAD=$EXPECTED_SOURCE_HEAD"
echo "BASE_RUNTIME_HEAD=$RUNTIME_HEAD"
echo "ASTRA_CODEX_REVIEW_CODE=INSTALLED"
echo "ASTRA_CODEX_REVIEW_DEPLOY=PASS"

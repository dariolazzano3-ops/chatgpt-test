#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SRC="${1:-}"
EXPECTED_SOURCE_HEAD="${2:-}"
SOURCE_BRANCH=factory/jarvis-astra-codex-review-v1
TARGET_BRANCH=factory/jarvis-capability-expansion-v3
MAINT=/usr/local/sbin/jarvis-maintenance
INBOX=/home/jarvis/.jarvis-maintenance/pending.tgz

[[ "$(id -un)" == "jarvis" ]] || { echo ASTRA_DEPLOY_USER_MISMATCH; exit 10; }
[[ -d "$SRC/.git" ]] || { echo SOURCE_REPO_REQUIRED; exit 11; }
[[ "$EXPECTED_SOURCE_HEAD" =~ ^[0-9a-f]{40}$ ]] || { echo SOURCE_HEAD_INVALID; exit 12; }
[[ "$(git -C "$SRC" rev-parse HEAD)" == "$EXPECTED_SOURCE_HEAD" ]] || { echo SOURCE_HEAD_MISMATCH; exit 13; }
[[ "$(git -C "$SRC" branch --show-current)" == "$SOURCE_BRANCH" ]] || { echo SOURCE_BRANCH_MISMATCH; exit 14; }
[[ -z "$(git -C "$SRC" status --porcelain)" ]] || { echo SOURCE_DIRTY; exit 15; }
[[ -x "$MAINT" ]] || { echo MAINTENANCE_HELPER_MISSING; exit 16; }
[[ ! -e "$INBOX" ]] || { echo MAINTENANCE_INBOX_BUSY; exit 17; }

STATUS_BEFORE="$(sudo -n "$MAINT" status)"
printf '%s\n' "$STATUS_BEFORE"
printf '%s\n' "$STATUS_BEFORE" | grep -Fq "$TARGET_BRANCH" || { echo RUNTIME_BRANCH_MISMATCH; exit 18; }
RUNTIME_HEAD="$(printf '%s\n' "$STATUS_BEFORE" | sed -nE 's/.*[Hh][Ee][Aa][Dd][=: ]+([0-9a-f]{40}).*/\1/p' | head -1)"
if [[ ! "$RUNTIME_HEAD" =~ ^[0-9a-f]{40}$ ]]; then
  RUNTIME_HEAD="$(printf '%s\n' "$STATUS_BEFORE" | grep -Eo '[0-9a-f]{40}' | head -1 || true)"
fi
[[ "$RUNTIME_HEAD" =~ ^[0-9a-f]{40}$ ]] || { echo RUNTIME_HEAD_UNRESOLVED; exit 19; }

STAGE="$(mktemp -d /tmp/jarvis-astra-codex-review-v1.XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/payload/src/jarvis" "$STAGE/payload/scripts"

# Only files that genuinely differ from the current runtime belong in the
# maintenance payload. Existing regression tests stay in the CHECKS list
# below and are executed in-place after patching, but identical files must
# not be declared as runtime diffs because the maintenance gate compares the
# manifest file set with the actual git diff set exactly.
FILES=(
  src/jarvis/intelligence-router-v1.js
  src/jarvis/owner-chat-job-v1.js
  src/jarvis/http-v1.js
  scripts/jarvis-astra-codex-post-review-v1-smoke.mjs
  scripts/jarvis-astra-http-flag-v1-smoke.mjs
)
for rel in "${FILES[@]}"; do
  [[ -f "$SRC/$rel" ]] || { echo "SOURCE_FILE_MISSING=$rel"; exit 20; }
  install -D -m 0644 "$SRC/$rel" "$STAGE/payload/$rel"
done

python3 - "$STAGE" "$RUNTIME_HEAD" "$TARGET_BRANCH" <<'PY'
import hashlib, json, pathlib, sys
stage=pathlib.Path(sys.argv[1])
head=sys.argv[2]
branch=sys.argv[3]
files=[]
for p in sorted((stage/"payload").rglob("*")):
    if not p.is_file():
        continue
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
  echo ASTRA_CODEX_REVIEW_DEPLOY=FAIL
  exit 21
fi

STATUS_AFTER="$(sudo -n "$MAINT" status)"
printf '%s\n' "$STATUS_AFTER"
printf '%s\n' "$STATUS_AFTER" | grep -Fq "$TARGET_BRANCH" || { echo POST_BRANCH_MISMATCH; exit 22; }
printf '%s\n' "$STATUS_AFTER" | grep -Eqi 'active|SERVICE_HEALTH=active' || { echo POST_SERVICE_NOT_ACTIVE; exit 23; }

RUNTIME=/opt/jarvis/chatgpt-test
for rel in src/jarvis/intelligence-router-v1.js src/jarvis/owner-chat-job-v1.js src/jarvis/http-v1.js; do
  [[ -f "$RUNTIME/$rel" ]] || { echo "RUNTIME_FILE_MISSING=$rel"; exit 24; }
  [[ "$(sha256sum "$SRC/$rel" | awk '{print $1}')" == "$(sha256sum "$RUNTIME/$rel" | awk '{print $1}')" ]] \
    || { echo "RUNTIME_FILE_MISMATCH=$rel"; exit 25; }
done

echo "SOURCE_HEAD=$EXPECTED_SOURCE_HEAD"
echo "BASE_RUNTIME_HEAD=$RUNTIME_HEAD"
echo "ASTRA_CODEX_REVIEW_CODE=INSTALLED"
echo "ASTRA_CODEX_REVIEW_DEPLOY=PASS"

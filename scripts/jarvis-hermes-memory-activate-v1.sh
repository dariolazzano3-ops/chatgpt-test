#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SRC="${1:-}"
RUNTIME=/opt/jarvis/chatgpt-test
INBOX=/home/jarvis/.jarvis-maintenance/pending.tgz
TARGET_BRANCH=factory/jarvis-capability-expansion-v3
FILES=(
  src/jarvis/hermes-core-http-client-v1.js
  src/jarvis/intelligence-router-v1.js
  src/jarvis/owner-chat-job-v1.js
  src/jarvis/http-v1.js
  scripts/jarvis-hermes-core-http-client-v1-smoke.mjs
  scripts/jarvis-hermes-core-integration-v1-smoke.mjs
  scripts/jarvis-intelligence-router-v1-smoke.mjs
  scripts/jarvis-owner-chat-intelligence-v1-smoke.mjs
)

[[ -d "$SRC/.git" ]] || { echo SOURCE_REPO_REQUIRED; exit 10; }
[[ -d "$RUNTIME/.git" && ! -L "$RUNTIME" ]] || { echo CANONICAL_RUNTIME_REQUIRED; exit 11; }
[[ "$(git -C "$RUNTIME" branch --show-current)" == "$TARGET_BRANCH" ]] || { echo RUNTIME_BRANCH_MISMATCH; exit 12; }
[[ -z "$(git -C "$RUNTIME" status --porcelain)" ]] || { echo RUNTIME_DIRTY; exit 13; }

BASE_HEAD="$(git -C "$RUNTIME" rev-parse HEAD)"
STAGE="$(mktemp -d /tmp/jarvis-hermes-memory-activate.XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/payload"

python3 - "$SRC" "$STAGE" "$BASE_HEAD" "$TARGET_BRANCH" "${FILES[@]}" <<'PY'
import hashlib,json,os,shutil,sys
src,stage,base,branch,*files=sys.argv[1:]
rows=[]
for rel in files:
    source=os.path.join(src,rel)
    if not os.path.isfile(source):
        raise SystemExit("MISSING_SOURCE_FILE:"+rel)
    target=os.path.join(stage,"payload",rel)
    os.makedirs(os.path.dirname(target),exist_ok=True)
    shutil.copy2(source,target)
    h=hashlib.sha256(open(target,"rb").read()).hexdigest()
    rows.append({"path":rel,"sha256":h})
manifest={
  "schema":"jarvis-maintenance-bundle.v1",
  "target_branch":branch,
  "expected_head":base,
  "files":rows,
  "checks":[
    "scripts/jarvis-hermes-core-http-client-v1-smoke.mjs",
    "scripts/jarvis-hermes-core-integration-v1-smoke.mjs",
    "scripts/jarvis-intelligence-router-v1-smoke.mjs",
    "scripts/jarvis-owner-chat-intelligence-v1-smoke.mjs"
  ],
  "commit_message":"feat(jarvis): activate Hermes memory integration v1"
}
open(os.path.join(stage,"manifest.json"),"w",encoding="utf-8").write(json.dumps(manifest,indent=2)+"\n")
PY

tar -czf "$STAGE/pending.tgz" -C "$STAGE" manifest.json payload
install -d -m 0700 /home/jarvis/.jarvis-maintenance
install -m 0600 "$STAGE/pending.tgz" "$INBOX"
sudo -n /usr/local/sbin/jarvis-maintenance install
sudo -n /usr/local/sbin/jarvis-maintenance status
echo "HERMES_MEMORY_CODE_ACTIVATION=PASS"

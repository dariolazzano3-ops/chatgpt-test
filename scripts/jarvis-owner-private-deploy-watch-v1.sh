#!/usr/bin/env bash
set -Eeuo pipefail
umask 007

QUEUE=/opt/jarvis/owner-deploy-queue
PENDING="$QUEUE/pending.tgz"
META="$QUEUE/pending.json"
RESULTS="$QUEUE/results"
MAINTENANCE_INBOX=/home/jarvis/.jarvis-maintenance/pending.tgz
MAINTENANCE=/usr/local/sbin/jarvis-maintenance
LOCK=/home/jarvis/.jarvis-owner-deploy-watch.lock

exec 9>"$LOCK"
flock -n 9 || exit 0

self_test() {
  [[ "$(id -un)" == jarvis ]] || { echo OWNER_DEPLOY_WATCH_USER_FAIL; exit 10; }
  [[ -d "$QUEUE" && -d "$RESULTS" ]] || { echo OWNER_DEPLOY_WATCH_QUEUE_FAIL; exit 11; }
  [[ -x "$MAINTENANCE" ]] || { echo OWNER_DEPLOY_WATCH_MAINTENANCE_FAIL; exit 12; }
  sudo -n "$MAINTENANCE" status >/dev/null
  echo OWNER_DEPLOY_WATCH_SELF_TEST_PASS
}

[[ "${1:-}" == "--self-test" ]] && { self_test; exit 0; }
[[ -f "$PENDING" && -f "$META" ]] || exit 0
[[ ! -L "$PENDING" && ! -L "$META" ]] || exit 20
[[ "$(stat -c %s "$PENDING")" -le 52428800 ]] || exit 21
[[ ! -e "$MAINTENANCE_INBOX" ]] || exit 0

mapfile -t META_FIELDS < <(python3 - "$META" <<'PY'
import json,re,sys
p=sys.argv[1]
with open(p,encoding='utf-8') as f:
    d=json.load(f)
if d.get('schema')!='aurentara.jarvis.owner-private-deploy-request.v1':
    raise SystemExit(30)
rid=str(d.get('request_id','')).strip().lower()
sc=str(d.get('source_commit','')).strip().lower()
st=str(d.get('source_tree','')).strip().lower()
rh=str(d.get('runtime_expected_head','')).strip().lower()
rb=str(d.get('runtime_branch','')).strip()
if not re.fullmatch(r'[a-z0-9._-]{8,80}',rid): raise SystemExit(31)
if not re.fullmatch(r'[0-9a-f]{40}',sc): raise SystemExit(32)
if not re.fullmatch(r'[0-9a-f]{40}',st): raise SystemExit(33)
if not re.fullmatch(r'[0-9a-f]{40}',rh): raise SystemExit(34)
if rb!='factory/jarvis-capability-expansion-v3': raise SystemExit(35)
print(rid); print(sc); print(st); print(rh); print(rb)
PY
)

REQUEST_ID="${META_FIELDS[0]}"
SOURCE_COMMIT="${META_FIELDS[1]}"
SOURCE_TREE="${META_FIELDS[2]}"
RUNTIME_EXPECTED_HEAD="${META_FIELDS[3]}"
RUNTIME_BRANCH="${META_FIELDS[4]}"

install -m 0600 "$PENDING" "$MAINTENANCE_INBOX"

set +e
OUT="$(sudo -n "$MAINTENANCE" install 2>&1)"
RC=$?
set -e

STATUS=FAILED
ERROR=MAINTENANCE_INSTALL_FAILED
RUNTIME_COMMIT=""
if [[ $RC -eq 0 ]] && grep -q '^MAINTENANCE_GATE_INSTALL_PASS$' <<<"$OUT"; then
  STATUS=DEPLOYED
  ERROR=""
  RUNTIME_COMMIT="$(sed -n 's/^MAINTENANCE_COMMIT=//p' <<<"$OUT" | tail -n1)"
fi

RESULT_TMP="$RESULTS/.${REQUEST_ID}.json.tmp"
RESULT_FINAL="$RESULTS/${REQUEST_ID}.json"
python3 - "$RESULT_TMP" "$REQUEST_ID" "$SOURCE_COMMIT" "$SOURCE_TREE" "$RUNTIME_EXPECTED_HEAD" "$RUNTIME_BRANCH" "$STATUS" "$ERROR" "$RUNTIME_COMMIT" <<'PY'
import json,sys
p,rid,sc,st,rh,rb,status,error,commit=sys.argv[1:]
doc={
  "schema":"aurentara.jarvis.owner-private-deploy-result.v1",
  "request_id":rid,
  "source_commit":sc,
  "source_tree":st,
  "runtime_expected_head":rh,
  "runtime_branch":rb,
  "status":status,
  "error":error or None,
  "runtime_commit":commit or None
}
with open(p,'w',encoding='utf-8') as f:
    json.dump(doc,f,indent=2,sort_keys=True)
    f.write("\n")
PY
chmod 0660 "$RESULT_TMP"
mv -f "$RESULT_TMP" "$RESULT_FINAL"

rm -f "$PENDING" "$META" "$MAINTENANCE_INBOX"

if [[ "$STATUS" == DEPLOYED ]]; then
  echo "OWNER_DEPLOY_WATCH_DEPLOYED request_id=$REQUEST_ID runtime_commit=$RUNTIME_COMMIT"
  exit 0
fi
echo "OWNER_DEPLOY_WATCH_FAILED request_id=$REQUEST_ID rc=$RC" >&2
exit 1

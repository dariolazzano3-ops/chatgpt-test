#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

QUEUE="${JARVIS_CONTROL_PLANE_QUEUE:-/opt/jarvis/owner-deploy-queue}"
REQ="$QUEUE/restart-request.v1.json"
RESULTS="$QUEUE/results"
MAINT="${JARVIS_MAINTENANCE_HELPER:-/usr/local/sbin/jarvis-maintenance}"
LOCK="${JARVIS_CONTROL_PLANE_LOCK:-/tmp/jarvis-control-plane-watch-v1.lock}"

if [[ "${1:-}" == "--self-test" ]]; then
  [[ "$REQ" == /* && "$RESULTS" == /* && "$MAINT" == /* ]]
  echo JARVIS_CONTROL_PLANE_WATCH_V1_SELF_TEST_PASS
  exit 0
fi
[[ $# -eq 0 ]] || { echo 'usage: jarvis-control-plane-watch-v1.sh [--self-test]' >&2; exit 64; }

mkdir -p "$RESULTS"
exec 9>"$LOCK"
flock -n 9 || exit 0
[[ -f "$REQ" ]] || exit 0

RID="$(python3 - "$REQ" <<'PY'
import json,re,sys
p=sys.argv[1]
d=json.load(open(p))
assert d.get('schema')=='aurentara.jarvis.control-plane-restart-request.v1'
rid=str(d.get('request_id','')).lower()
assert re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}',rid)
reason=str(d.get('reason',''))
assert 1 <= len(reason) <= 200
print(rid)
PY
)" || { echo CONTROL_PLANE_RESTART_REQUEST_INVALID >&2; exit 65; }

PROCESSING="$QUEUE/.restart-request.$RID.processing.json"
mv "$REQ" "$PROCESSING"

set +e
OUT="$(sudo -n "$MAINT" restart 2>&1)"
RC=$?
set -e
STATUS=FAILED
[[ $RC -eq 0 ]] && STATUS=PASS
RESULT="$RESULTS/control-plane-restart-$RID.json"

python3 - "$RESULT" "$RID" "$STATUS" "$RC" "$OUT" <<'PY'
import json,sys,datetime
p,rid,status,rc,out=sys.argv[1:]
payload={
 'schema':'aurentara.jarvis.control-plane-restart-result.v1',
 'request_id':rid,
 'status':status,
 'exit_code':int(rc),
 'maintenance_output':out[-4000:],
 'completed_at':datetime.datetime.now(datetime.timezone.utc).isoformat()
}
open(p,'w').write(json.dumps(payload,indent=2)+'\n')
PY
chmod 0660 "$RESULT" || true

if [[ $RC -eq 0 ]]; then
  rm -f "$PROCESSING"
  echo "CONTROL_PLANE_RESTART_PASS=$RID"
  exit 0
fi
mv "$PROCESSING" "$QUEUE/restart-request.failed.$RID.json"
echo "CONTROL_PLANE_RESTART_FAILED=$RID rc=$RC" >&2
exit "$RC"

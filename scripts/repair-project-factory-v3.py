#!/usr/bin/python3 -I
"""Owner-console one-shot: scoped JARVIS Factory repair, dormant project enrollment."""
import hashlib
import json
import os
from pathlib import Path
import pwd
import shutil
import stat
import subprocess
import sys
import tempfile
import uuid

SOURCE = Path('/home/jarvis/auto-project-routing-v1/scripts/jarvis-project-factory-onboard-v1.mjs')
INSTALLED = Path('/opt/jarvis/project-factory/onboard.mjs')
REGISTRY = Path('/opt/jarvis/owner-deploy-queue/project-targets.v1.json')
REQUEST = Path('/opt/jarvis/project-factory/inbox/request-lukas-paff.json')
WORKSPACE = Path('/opt/jarvis/project-workspaces/LUKAS_PAFF')
LOCK = Path('/opt/jarvis/project-factory/inbox/.reconcile.lock')
REPORT = Path('/home/jarvis/jrf-result.txt')
EXPECTED_JS_SHA = '73703d36de7d6a565172294b97d36e8d9036a52db098b7b2a5ae129ba6db6e1f'
EXPECTED_HEAD = 'd3275cfe7e43c4435325e4a8202fed609eb9c416'
TIMER = 'jarvis-project-factory.timer'
SERVICE = 'jarvis-project-factory.service'

def run(args, timeout=180, check=True):
    r = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                       text=True, timeout=timeout, env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LANG':'C.UTF-8'})
    if check and r.returncode:
        raise RuntimeError(f'COMMAND_FAILED {args[0]} {r.returncode}: {r.stdout[-400:]}')
    return r

def atomic_bytes(path, data, uid, gid, mode):
    fd, name = tempfile.mkstemp(prefix='.jrf-', dir=str(path.parent))
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(data); f.flush(); os.fsync(f.fileno())
            os.fchown(f.fileno(), uid, gid); os.fchmod(f.fileno(), mode)
        os.replace(name, path)
    finally:
        if os.path.exists(name): os.unlink(name)

def safe_file(path, owner=None):
    s = path.lstat()
    if not stat.S_ISREG(s.st_mode) or (owner is not None and s.st_uid != owner) or s.st_mode & 0o022:
        raise RuntimeError('UNSAFE_FILE '+str(path))
    return s

def validate(root_uid):
    if os.geteuid() != 0:
        raise RuntimeError('AUTHENTICATED_ROOT_CONSOLE_REQUIRED')
    for p in (INSTALLED, REGISTRY, REQUEST):
        safe_file(p)
    current = json.loads(REGISTRY.read_bytes())
    if current.get('schema') != 'aurentara.jarvis.project-target-registry.v1' or current.get('revision') != 4:
        raise RuntimeError('REGISTRY_DRIFT')
    if set(current.get('targets',{})) != {'AURENTARA','JARVIS_AUTONOMY_TEST'}:
        raise RuntimeError('TARGET_REGISTRY_DRIFT')
    q = json.loads(REQUEST.read_bytes())
    required = {'target_id':'LUKAS_PAFF','repository':'dariolazzano3-ops/chatgpt-test',
                'branch':'factory/lukas-paff-premium-v1','subdirectory':'projects/lukas-paff-premium-v1',
                'expected_head':EXPECTED_HEAD}
    if any(q.get(k) != v for k,v in required.items()):
        raise RuntimeError('REQUEST_DIFFERS_FROM_APPROVED_PROJECT')
    data = SOURCE.read_bytes()
    if hashlib.sha256(data).hexdigest() != EXPECTED_JS_SHA:
        raise RuntimeError('SOURCE_SHA_MISMATCH')
    if WORKSPACE.is_symlink():
        raise RuntimeError('WORKSPACE_IS_SYMLINK')
    if WORKSPACE.exists():
        w = WORKSPACE.lstat()
        if not stat.S_ISDIR(w.st_mode) or w.st_uid != root_uid:
            raise RuntimeError('UNEXPECTED_PARTIAL_WORKSPACE_OWNER')
        old = run(['/usr/bin/git','-c',f'safe.directory={WORKSPACE}','-C',str(WORKSPACE),'rev-parse','HEAD'])
        if old.stdout.strip() != EXPECTED_HEAD:
            raise RuntimeError('UNEXPECTED_PARTIAL_WORKSPACE_HEAD')
        dirty = run(['/usr/bin/git','-c',f'safe.directory={WORKSPACE}','-C',str(WORKSPACE),'status','--porcelain=v1'])
        if dirty.stdout.strip():
            raise RuntimeError('PARTIAL_WORKSPACE_HAS_UNPRESERVED_EDITS')
    return current, data

def main():
    operator = pwd.getpwnam('jarvis-operator')
    jarvis = pwd.getpwnam('jarvis')
    old, src = validate(operator.pw_uid)
    installed_st = safe_file(INSTALLED, operator.pw_uid)
    registry_st = safe_file(REGISTRY)
    run(['/usr/bin/node','--check',str(SOURCE)])
    backup_dir = Path(tempfile.mkdtemp(prefix='jrf-backup-',dir='/var/backups'))
    backup_dir.chmod(0o700)
    (backup_dir/'onboard.old').write_bytes(INSTALLED.read_bytes())
    (backup_dir/'registry.old').write_bytes(REGISTRY.read_bytes())
    print('PREFLIGHT_PASS BACKUP_DIR='+str(backup_dir),flush=True)
    was_timer_active = run(['/usr/bin/systemctl','is-active',TIMER],check=False).returncode == 0
    installed_changed = False
    quarantined = None
    registered = False
    try:
        run(['/usr/bin/systemctl','stop',TIMER])
        run(['/usr/bin/systemctl','stop',SERVICE])
        if LOCK.exists() or LOCK.is_symlink():
            safe_file(LOCK,operator.pw_uid)
            LOCK.unlink()
        if WORKSPACE.exists():
            quarantined = WORKSPACE.with_name('.incomplete-lukas-paff-'+uuid.uuid4().hex[:12])
            if quarantined.exists(): raise RuntimeError('QUARANTINE_PATH_EXISTS')
            WORKSPACE.rename(quarantined)
            quarantined.chmod(0o700)
            print('PARTIAL_WORKSPACE_PRESERVED='+str(quarantined),flush=True)
        atomic_bytes(INSTALLED,src,installed_st.st_uid,installed_st.st_gid,stat.S_IMODE(installed_st.st_mode))
        installed_changed = True
        run(['/usr/bin/systemctl','reset-failed',SERVICE])
        run(['/usr/bin/systemctl','start',SERVICE],timeout=240)
        fresh = json.loads(REGISTRY.read_bytes())
        if fresh.get('revision') != 5 or set(fresh.get('targets',{})) != (set(old['targets'])|{'LUKAS_PAFF'}):
            raise RuntimeError('REGISTRATION_MISSING_OR_EXTRA_TARGET')
        if any(fresh['targets'][k] != old['targets'][k] for k in old['targets']):
            raise RuntimeError('EXISTING_TARGET_MODIFIED')
        if fresh['targets']['LUKAS_PAFF'].get('enabled') is not False:
            raise RuntimeError('NEW_TARGET_NOT_DORMANT')
        ws = WORKSPACE.lstat()
        if not stat.S_ISDIR(ws.st_mode) or ws.st_uid!=operator.pw_uid or ws.st_gid!=operator.pw_gid or stat.S_IMODE(ws.st_mode)!=0o700:
            raise RuntimeError('ISOLATION_ROOT_MODE_FAILED')
        head = run(['/usr/bin/git','-c',f'safe.directory={WORKSPACE}','-C',str(WORKSPACE),'rev-parse','HEAD']).stdout.strip()
        if head != EXPECTED_HEAD: raise RuntimeError('WORKSPACE_HEAD_CHANGED')
        registered = True
        print('FACTORY_REGISTRATION_PASS',flush=True)
        print('LUKAS_PAFF_ENABLED=false',flush=True)
        print('WORKSPACE_HEAD='+head,flush=True)
        print('NO_CLAUDE_JOB_NO_CORE_RESTART_NO_PUBLIC_DEPLOY',flush=True)
    except BaseException:
        run(['/usr/bin/systemctl','stop',SERVICE],check=False)
        if installed_changed:
            atomic_bytes(INSTALLED,(backup_dir/'onboard.old').read_bytes(),installed_st.st_uid,installed_st.st_gid,stat.S_IMODE(installed_st.st_mode))
        now = json.loads(REGISTRY.read_bytes())
        if now.get('targets',{}) == old['targets'] or (
            set(now.get('targets',{}))==set(old['targets'])|{'LUKAS_PAFF'} and
            all(now['targets'].get(k)==v for k,v in old['targets'].items())):
            atomic_bytes(REGISTRY,(backup_dir/'registry.old').read_bytes(),registry_st.st_uid,registry_st.st_gid,stat.S_IMODE(registry_st.st_mode))
        else:
            print('REGISTRY_DRIFT_NO_AUTOMATIC_OVERWRITE',flush=True)
        if WORKSPACE.exists() and WORKSPACE.is_dir() and not WORKSPACE.is_symlink():
            failed = WORKSPACE.with_name('.failed-lukas-paff-'+uuid.uuid4().hex[:12])
            WORKSPACE.rename(failed)
            failed.chmod(0o700)
            print('FAILED_WORKSPACE_PRESERVED='+str(failed),flush=True)
        raise
    finally:
        if was_timer_active:
            run(['/usr/bin/systemctl','start',TIMER],check=False)
        result = {'registration_pass':registered,'project':'LUKAS_PAFF','enabled':False if registered else None,
                  'git_head':EXPECTED_HEAD if registered else None,'backup_dir':str(backup_dir),
                  'partial_workspace_backup':str(quarantined) if quarantined else None,
                  'core_restarted':False,'paid_claude_job':False}
        atomic_bytes(REPORT,(json.dumps(result,indent=2)+'\n').encode(),jarvis.pw_uid,jarvis.pw_gid,0o600)

if __name__=='__main__':
    try: main()
    except Exception as exc:
        print('FACTORY_REPAIR_FAILED='+str(exc)[:500],file=sys.stderr)
        sys.exit(2)

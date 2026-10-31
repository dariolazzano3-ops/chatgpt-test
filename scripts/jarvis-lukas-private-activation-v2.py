#!/usr/bin/python3
"""One-time scoped Lukas Paff activation via existing JARVIS maintenance gate.

No Claude calls, no production deploy, no Docker changes, no new privileges.
Requires a trusted root console. Fail closed and restore registry/env on failure.
"""
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

EXPECTED_RUNTIME_HEAD = '220e3012798e04578964d61506fc33ec8c2fa1d5'
EXPECTED_BUNDLE_SHA = 'b5dfed35fa76b12815aeea7a757a476ac38c7df0c21d07588690cf6ea6a8401e'
RUNTIME = Path('/opt/jarvis/chatgpt-test')
REGISTRY = Path('/opt/jarvis/owner-deploy-queue/project-targets.v1.json')
ENV_FILE = Path('/etc/jarvis/remote-operator.env')
TOKEN_FILE = Path('/etc/jarvis/claude-lukas-paff-v1/bridge_token')
BUNDLE = Path('/home/jarvis/.jarvis-maintenance/pending.tgz')
TARGET = Path('/opt/jarvis/project-workspaces/LUKAS_PAFF')
PROJECT = 'lukas-paff-premium-v1'
WORKER = 'jarvis-claude-lukas-paff-v1'
MAINT = '/usr/local/sbin/jarvis-maintenance'
BRIDGE_URL = 'http://127.0.0.1:18789'

def run(cmd, timeout=40):
    return subprocess.run(cmd, check=True, capture_output=True, text=True,
                          timeout=timeout).stdout.strip()

def owner_status():
    # urllib does not provide a Unix socket transport; curl uses the existing
    # private owner-control interface, not an unauthenticated public endpoint.
    output = run(['/usr/bin/curl', '-fsS', '--max-time', '6', '--unix-socket',
                  '/opt/jarvis/owner-deploy-queue/owner-control.sock',
                  'http://localhost/v1/status'], timeout=9)
    value = json.loads(output)
    if value.get('ok') is not True or value.get('core_online') is not True:
        raise RuntimeError('OWNER_CONTROL_NOT_HEALTHY')
    return value

def git(*args):
    return run(['/usr/sbin/runuser', '-u', 'jarvis-operator', '--',
                '/usr/bin/git', '-c', 'safe.directory='+str(RUNTIME),
                '-C', str(RUNTIME), *args])

def docker_inspect(name):
    output = run(['/usr/bin/docker', 'inspect', name])
    rows = json.loads(output)
    if len(rows) != 1: raise RuntimeError('DOCKER_INSPECT_AMBIGUOUS')
    return rows[0]

def assert_worker_mounts(actual, expected):
    if actual != expected:
        raise RuntimeError('LUKAS_WORKER_MOUNTS_NOT_ISOLATED')


def worker_preflight():
    for name in ('jarvis-claude', 'hermes', WORKER):
        if docker_inspect(name).get('State', {}).get('Running') is not True:
            raise RuntimeError('REQUIRED_CONTAINER_STOPPED_'+name)
    c = docker_inspect(WORKER)
    if c.get('Config', {}).get('User') not in ('11000:11000', '11000'):
        raise RuntimeError('LUKAS_WORKER_IDENTITY_UNEXPECTED')
    h = c.get('HostConfig') or {}
    if h.get('Privileged') or h.get('NetworkMode') != 'jarvis-internal':
        raise RuntimeError('LUKAS_WORKER_PRIVILEGE_OR_NETWORK_UNEXPECTED')
    if 'no-new-privileges:true' not in (h.get('SecurityOpt') or []):
        raise RuntimeError('LUKAS_WORKER_NO_NEW_PRIVILEGES_MISSING')
    if (h.get('PortBindings') or {}).get('8788/tcp') != [
        {'HostIp':'127.0.0.1','HostPort':'18789'}
    ]:
        raise RuntimeError('LUKAS_BRIDGE_NOT_LOOPBACK_ONLY')
    actual = {
        (m.get('Source'), m.get('Destination'), m.get('RW'))
        for m in (c.get('Mounts') or [])
    }
    # The verified worker uses a READ-ONLY project root and overlays exactly
    # one writable website subtree, rather than exposing the entire checkout.
    expected = {
        (str(TARGET), '/workspace/projects/'+PROJECT, False),
        (str(TARGET/'.git'), '/workspace/projects/'+PROJECT+'/.git', False),
        (str(TARGET/'projects'/PROJECT),
         '/workspace/projects/'+PROJECT+'/projects/'+PROJECT, True),
        ('/home/jarvis/claude-worker/bridge/bridge.py',
         '/opt/jarvis-bridge/bridge.py', False),
        ('/etc/jarvis/claude-lukas-paff-v1',
         '/home/claude/.claude', True)
    }
    assert_worker_mounts(actual, expected)
    checks = [
        'test -r /workspace/projects/'+PROJECT+'/.git/HEAD',
        'test ! -w /workspace/projects/'+PROJECT+'/.git/HEAD',
        'test ! -w /workspace/projects/'+PROJECT,
        'test -w /workspace/projects/'+PROJECT+'/projects/'+PROJECT+'/preview.html',
        'test ! -e /workspace/projects/aurentara-real-lifecycle-v1',
        'test ! -e /workspace/projects/jarvis-autonomy-test-v1',
        'test "$(ls -1 /workspace/projects | wc -l)" -eq 1',
        'test ! -e /var/run/docker.sock'
    ]
    for index, expression in enumerate(checks, 1):
        try:
            run(['/usr/bin/docker','exec','-u','11000:11000',WORKER,
                 'sh','-c', expression],timeout=15)
        except Exception:
            raise RuntimeError('LUKAS_WORKER_FILE_SCOPE_CHECK_'+str(index)+'_FAILED')
    try:
        with urllib.request.urlopen(BRIDGE_URL+'/health', timeout=4) as r:
            if r.status != 200 or json.load(r).get('ok') is not True:
                raise RuntimeError('LUKAS_BRIDGE_HEALTH_INVALID')
    except urllib.error.URLError:
        raise RuntimeError('LUKAS_BRIDGE_HEALTH_UNAVAILABLE')
    print('LUKAS_ISOLATION_PREFLIGHT_PASS',flush=True)

def write_atomic(path, data, previous_stat):
    fd, temp = tempfile.mkstemp(prefix='.jarvis-lukas-', dir=str(path.parent))
    try:
        with os.fdopen(fd,'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
            os.fchmod(stream.fileno(), stat.S_IMODE(previous_stat.st_mode))
            os.fchown(stream.fileno(), previous_stat.st_uid, previous_stat.st_gid)
        os.replace(temp,path)
    finally:
        if os.path.exists(temp): os.unlink(temp)

def activate():
    if os.geteuid() != 0: raise RuntimeError('AUTHORIZED_ROOT_CONSOLE_REQUIRED')
    if git('branch','--show-current') != 'factory/jarvis-capability-expansion-v3':
        raise RuntimeError('WRONG_INSTALLED_RUNTIME_BRANCH')
    if git('rev-parse','HEAD') != EXPECTED_RUNTIME_HEAD:
        raise RuntimeError('RUNTIME_CHANGED_SINCE_APPROVED_EXPORT')
    if git('status','--porcelain'): raise RuntimeError('RUNTIME_WORKTREE_DIRTY')
    if not BUNDLE.is_file() or BUNDLE.is_symlink(): raise RuntimeError('BUNDLE_UNAVAILABLE')
    import hashlib
    if hashlib.sha256(BUNDLE.read_bytes()).hexdigest()!=EXPECTED_BUNDLE_SHA:
        raise RuntimeError('BUNDLE_SHA256_MISMATCH')
    reg=json.loads(REGISTRY.read_text())
    t=reg.get('targets',{}).get('LUKAS_PAFF',{})
    if (reg.get('revision') != 5 or t.get('enabled') is not False or
        t.get('repo_dir') != str(TARGET) or
        t.get('target_branch') != 'factory/lukas-paff-premium-v1' or
        t.get('bridge_project') != PROJECT):
        raise RuntimeError('LUKAS_REGISTRY_UNEXPECTED')
    if run(['/usr/sbin/runuser','-u','jarvis-operator','--','/usr/bin/git',
            '-c','safe.directory='+str(TARGET),'-C',str(TARGET),
            'branch','--show-current']) != t['target_branch']:
        raise RuntimeError('LUKAS_CHECKOUT_BRANCH_MISMATCH')
    if run(['/usr/sbin/runuser','-u','jarvis-operator','--','/usr/bin/git',
            '-c','safe.directory='+str(TARGET),'-C',str(TARGET),
            'status','--porcelain']):
        raise RuntimeError('LUKAS_CHECKOUT_DIRTY')
    current=owner_status().get('automatic_project_target_status') or {}
    if (set(['AURENTARA','JARVIS_AUTONOMY_TEST']) -
        set(current.get('target_ids') or []) or
        'LUKAS_PAFF' not in (current.get('registry_disabled_target_ids') or [])):
        raise RuntimeError('BASELINE_PROJECT_STATUS_UNEXPECTED')
    worker_preflight()
    token=TOKEN_FILE.read_text().strip()
    if not re.fullmatch(r'[A-Za-z0-9._~+/-]{16,200}',token):
        raise RuntimeError('ISOLATED_BRIDGE_TOKEN_FORMAT_INVALID')
    env_data=ENV_FILE.read_text()
    keys=('JARVIS_PROJECT_LUKAS_PAFF_BRIDGE_URL',
          'JARVIS_PROJECT_LUKAS_PAFF_BRIDGE_TOKEN')
    if any(re.search(r'(?m)^\s*'+k+r'\s*=',env_data) for k in keys):
        raise RuntimeError('EXISTING_LUKAS_ENV_ENTRY_REQUIRES_REVIEW')
    env_updated=(env_data.rstrip('\n')+'\n'+
                 keys[0]+'='+BRIDGE_URL+'\n'+
                 keys[1]+'='+token+'\n').encode()
    next_reg=json.loads(REGISTRY.read_text())
    next_reg['targets']['LUKAS_PAFF']['enabled']=True
    next_reg['targets']['LUKAS_PAFF']['isolated_worker']=True
    next_reg['revision']+=1
    from datetime import datetime,timezone
    next_reg['updated_at']=datetime.now(timezone.utc).isoformat()
    next_bytes=(json.dumps(next_reg,indent=2)+'\n').encode()
    print('PREINSTALL_VALIDATION_PASS',flush=True)
    completed=run([MAINT,'install'],timeout=180)
    if 'MAINTENANCE_GATE_INSTALL_PASS' not in completed:
        raise RuntimeError('MAINTENANCE_INSTALL_DID_NOT_ATTEST_SUCCESS')
    print('MAINTENANCE_GATE_INSTALL_PASS',flush=True)
    backup=Path(tempfile.mkdtemp(prefix='jarvis-lukas-activate-',dir='/root'))
    os.chmod(backup,0o700)
    shutil.copy2(ENV_FILE,backup/'remote-operator.env')
    shutil.copy2(REGISTRY,backup/'project-targets.v1.json')
    changed=False
    try:
        write_atomic(ENV_FILE,env_updated,ENV_FILE.stat())
        changed=True
        write_atomic(REGISTRY,next_bytes,REGISTRY.stat())
        out=run([MAINT,'restart'],timeout=130)
        if 'MAINTENANCE_RESTART_PASS' not in out:
            raise RuntimeError('MAINTENANCE_RESTART_ATTESTATION_MISSING')
        current=owner_status().get('automatic_project_target_status') or {}
        required={'AURENTARA','JARVIS_AUTONOMY_TEST','LUKAS_PAFF'}
        if not required.issubset(set(current.get('target_ids') or [])):
            raise RuntimeError('LUKAS_NOT_READY_IN_OWNER_CONTROL_STATUS')
        if current.get('registry_revision') != 6:
            raise RuntimeError('REGISTRY_REVISION_NOT_LIVE')
        if current.get('registry_errors'):
            raise RuntimeError('LIVE_PROJECT_REGISTRY_ERRORS')
        if not json.loads(REGISTRY.read_text())['targets']['LUKAS_PAFF']['enabled']:
            raise RuntimeError('LUKAS_FLAG_NOT_PERSISTED')
        worker_preflight()
    except BaseException:
        if changed:
            write_atomic(ENV_FILE,(backup/'remote-operator.env').read_bytes(),
                         ENV_FILE.stat())
            write_atomic(REGISTRY,(backup/'project-targets.v1.json').read_bytes(),
                         REGISTRY.stat())
            try: run([MAINT,'restart'],timeout=130)
            except Exception: print('ROLLBACK_RESTART_NEEDS_OWNER_CHECK',flush=True)
            print('ACTIVATION_ROLLED_BACK_LUKAS_STILL_DISABLED',flush=True)
        raise
    print('LUKAS_PAFF_LIVE_ACTIVATION_PASS',flush=True)
    print('REGISTRY_REVISION=6',flush=True)
    print('OTHER_PROJECTS_REMAIN_REGISTERED',flush=True)
    print('NO_CLAUDE_CALL_NO_PUBLIC_DEPLOY_NO_BILLING',flush=True)

if __name__=='__main__':
    try: activate()
    except Exception as exc:
        print('ACTIVATION_BLOCKED='+type(exc).__name__+':'+str(exc)[:220],
              file=sys.stderr,flush=True)
        sys.exit(2)

#!/usr/bin/python3
"""One-time scoped Lukas Paff Claude Docker bootstrap. No Claude/model requests."""
import json
import os
from pathlib import Path
import pwd
import grp
import shutil
import stat
import subprocess
import sys
import time
import urllib.request
import uuid

DOCKER = '/usr/bin/docker'
TARGET = Path('/opt/jarvis/project-workspaces/LUKAS_PAFF')
PROJECT = TARGET / 'projects/lukas-paff-premium-v1'
REGISTRY = Path('/opt/jarvis/owner-deploy-queue/project-targets.v1.json')
OLD_CONFIG = Path('/home/jarvis/claude-worker/config')
NEW_CONFIG = Path('/etc/jarvis/claude-lukas-paff-v1')
BRIDGE = Path('/home/jarvis/claude-worker/bridge/bridge.py')
NAME = 'jarvis-claude-lukas-paff-v1'
PORT = 18789
DEST = '/workspace/projects/lukas-paff-premium-v1'

def docker(*args, timeout=25):
    return subprocess.run([DOCKER,*args],check=True,text=True,
                          capture_output=True,timeout=timeout).stdout

def ensure_regular(path):
    st = path.lstat()
    if not stat.S_ISREG(st.st_mode) or stat.S_ISLNK(st.st_mode):
        raise RuntimeError('EXPECTED_REGULAR_FILE: ' + str(path))
    return path

def verify():
    if os.geteuid() != 0:
        raise RuntimeError('ROOT_CONSOLE_REQUIRED')
    data = json.loads(REGISTRY.read_text())
    row = data['targets']['LUKAS_PAFF']
    if row['repo_dir'] != str(TARGET) or row['target_branch'] != 'factory/lukas-paff-premium-v1' or row['enabled']:
        raise RuntimeError('TARGET_REGISTRY_UNEXPECTED')
    if not TARGET.is_dir() or not PROJECT.is_dir() or not (TARGET / '.git').is_dir():
        raise RuntimeError('PROJECT_WORKSPACE_NOT_READY')
    if TARGET.is_symlink() or PROJECT.is_symlink():
        raise RuntimeError('SYMLINK_TARGET_FORBIDDEN')
    ensure_regular(BRIDGE)
    ensure_regular(OLD_CONFIG / '.credentials.json')
    ensure_regular(OLD_CONFIG / 'bridge_token')
    ensure_regular(OLD_CONFIG / 'settings.json')
    for file in ('system-prompt.txt','agents.json'):
        ensure_regular(OLD_CONFIG / 'jarvis-enhancement-v1' / file)
    before = json.loads(docker('inspect','jarvis-claude'))[0]
    hermes = json.loads(docker('inspect','hermes'))[0]
    if not before['State']['Running'] or not hermes['State']['Running']:
        raise RuntimeError('EXISTING_WORKER_NOT_RUNNING')
    if before['Config'].get('Image') != 'jarvis-claude-worker:3':
        raise RuntimeError('UNEXPECTED_IMAGE')
    network = json.loads(docker('network','inspect','jarvis-internal'))[0]
    if network.get('Driver') != 'bridge':
        raise RuntimeError('UNEXPECTED_NETWORK_DRIVER')
    owner = pwd.getpwnam('jarvis-operator')
    git = ['/usr/sbin/runuser','-u','jarvis-operator','--','/usr/bin/git',
           '-c','safe.directory='+str(TARGET),'-C',str(TARGET)]
    branch = subprocess.run(git + ['branch','--show-current'],capture_output=True,
                            text=True,check=True,timeout=30).stdout.strip()
    dirty = subprocess.run(git + ['status','--porcelain'],capture_output=True,
                           text=True,check=True,timeout=30).stdout.strip()
    if branch != row['target_branch'] or dirty:
        raise RuntimeError('PROJECT_BRANCH_OR_CLEAN_CHECK_FAILED')
    print('PREFLIGHT_PASS')
    for label, check_path in (
        ('TARGET', TARGET), ('PROJECTS_PARENT', TARGET/'projects'),
        ('PROJECT', PROJECT), ('PREVIEW', PROJECT/'preview.html'),
        ('GIT', TARGET/'.git'), ('GIT_HEAD', TARGET/'.git/HEAD')
    ):
        s = check_path.lstat()
        if check_path.is_symlink():
            raise RuntimeError('SYMLINK_IN_WORKSPACE: '+label)
        print('HOST_'+label+'_PERMISSIONS='+oct(stat.S_IMODE(s.st_mode))+
              ',UID='+str(s.st_uid)+',GID='+str(s.st_gid), flush=True)
    print('TARGET_BRANCH='+branch)
    print('EXISTING_CONTAINERS_RUNNING=true')
    print('NETWORK=jarvis-internal')
    return before['Image'], owner.pw_uid

def prepare_profile():
    if NEW_CONFIG.exists() or NEW_CONFIG.is_symlink():
        if NEW_CONFIG.is_symlink() or not NEW_CONFIG.is_dir():
            raise RuntimeError('PROFILE_PATH_CONFLICT')
        print('PROFILE_ALREADY_EXISTS')
        return
    tmp = Path(str(NEW_CONFIG)+'.pending-'+uuid.uuid4().hex)
    tmp.mkdir(mode=0o700)
    try:
        os.chown(tmp,11000,11000)
        for name in ('.credentials.json','bridge_token','settings.json'):
            dst = tmp / name
            shutil.copyfile(ensure_regular(OLD_CONFIG/name),dst)
            os.chmod(dst,0o600)
            os.chown(dst,11000,11000)
        enhancement = tmp / 'jarvis-enhancement-v1'
        enhancement.mkdir(mode=0o700)
        os.chown(enhancement,11000,11000)
        for name in ('system-prompt.txt','agents.json'):
            dst = enhancement / name
            shutil.copyfile(ensure_regular(OLD_CONFIG/'jarvis-enhancement-v1'/name),dst)
            os.chmod(dst,0o600)
            os.chown(dst,11000,11000)
        tmp.rename(NEW_CONFIG)
    finally:
        if tmp.exists(): shutil.rmtree(tmp)
    print('ISOLATED_CREDENTIAL_PROFILE_CREATED')

def expose_readonly_git_metadata():
    g = TARGET / '.git'
    gid = grp.getgrnam('jarvis-worker').gr_gid
    for base,dirs,files in os.walk(g,topdown=True,followlinks=False):
        b = Path(base)
        if b.is_symlink(): raise RuntimeError('GIT_SYMLINK_DIR')
        os.chown(b,-1,gid)
        os.chmod(b,0o750)
        for name in dirs + files:
            p = b/name
            if p.is_symlink(): raise RuntimeError('GIT_SYMLINK_ENTRY')
            if not p.is_dir() and not p.is_file():
                raise RuntimeError('GIT_SPECIAL_FILE')
            os.chown(p,-1,gid)
            os.chmod(p,0o750 if p.is_dir() else 0o640)
    print('GIT_METADATA_GROUP_READONLY')

def verify_worker():
    record = json.loads(docker('inspect',NAME))[0]
    if record.get('State',{}).get('Running') is not True:
        raise RuntimeError('LUKAS_CONTAINER_NOT_RUNNING')
    mounts = {(m['Source'],m['Destination'],m['RW']) for m in record['Mounts']}
    expected = {
        (str(TARGET),DEST,True),
        (str(TARGET/'.git'),DEST+'/.git',False),
        (str(BRIDGE),'/opt/jarvis-bridge/bridge.py',False),
        (str(NEW_CONFIG),'/home/claude/.claude',True)}
    if mounts != expected:
        raise RuntimeError('UNEXPECTED_DOCKER_MOUNTS')
    h = record['HostConfig']
    if h.get('Privileged') or h.get('NetworkMode') != 'jarvis-internal':
        raise RuntimeError('UNSAFE_CONTAINER_PRIVILEGE_OR_NETWORK')
    if 'no-new-privileges:true' not in (h.get('SecurityOpt') or []):
        raise RuntimeError('NO_NEW_PRIVILEGES_MISSING')
    p = h.get('PortBindings') or {}
    if p.get('8788/tcp') != [{'HostIp':'127.0.0.1','HostPort':str(PORT)}]:
        raise RuntimeError('UNEXPECTED_PORT_BINDING')
    access_checks = {
        'GIT_METADATA_READABLE': 'test -r '+DEST+'/.git/HEAD',
        'GIT_METADATA_READ_ONLY': 'test ! -w '+DEST+'/.git/HEAD',
        'PROJECT_PREVIEW_WRITABLE': 'test -w '+DEST+'/projects/lukas-paff-premium-v1/preview.html',
        'AURENTARA_NOT_VISIBLE': 'test ! -e /workspace/projects/aurentara-real-lifecycle-v1',
        'AUTONOMY_TEST_NOT_VISIBLE': 'test ! -e /workspace/projects/jarvis-autonomy-test-v1',
        'PROJECT_ROOT_SINGLE_ENTRY': 'test "$(ls -1 /workspace/projects | wc -l)" -eq 1'
    }
    failures = []
    for label, check in access_checks.items():
        result = subprocess.run([DOCKER, 'exec', '-u', '11000:11000', NAME,
                                 'sh', '-c', check], capture_output=True,
                                text=True, timeout=15)
        ok = result.returncode == 0
        print('ACCESS_'+label+'='+('PASS' if ok else 'FAIL'), flush=True)
        if not ok: failures.append(label)
    if failures:
        raise RuntimeError('WORKER_ACCESS_CHECK_FAILED: '+','.join(failures))
    inside = docker('exec','-u','11000:11000',NAME,'git','-C',DEST,
                    'rev-parse','--is-inside-work-tree').strip()
    if inside != 'true': raise RuntimeError('WORKER_GIT_NOT_READABLE')
    for _ in range(12):
        try:
            with urllib.request.urlopen('http://127.0.0.1:'+str(PORT)+'/health',timeout=2) as response:
                body=json.load(response)
                if body.get('ok') is True:
                    print('BRIDGE_HEALTH_PASS')
                    break
        except Exception:
            time.sleep(1)
    else: raise RuntimeError('BRIDGE_HEALTH_FAILED')
    if not json.loads(docker('inspect','jarvis-claude'))[0]['State']['Running']:
        raise RuntimeError('EXISTING_CLAUDE_CHANGED')
    if not json.loads(docker('inspect','hermes'))[0]['State']['Running']:
        raise RuntimeError('HERMES_CHANGED')
    print('ISOLATION_NEGATIVE_TEST_PASS')
    print('PROJECT_GIT_READ_PASS')
    print('ORIGINAL_WORKERS_UNCHANGED_PASS')
    print('LUKAS_NOT_ACTIVATED_NO_MODEL_CALLS')

def main():
    image,_=verify()
    existing = subprocess.run([DOCKER,'container','inspect',NAME],
        stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
    if existing:
        print('EXISTING_LUKAS_WORKER_VERIFY_ONLY')
        verify_worker()
        return
    prepare_profile()
    expose_readonly_git_metadata()
    args=['run','-d','--name',NAME,'--restart','unless-stopped','--user','11000:11000',
          '--network','jarvis-internal','--publish','127.0.0.1:'+str(PORT)+':8788',
          '--security-opt','no-new-privileges:true','--cap-drop','ALL','--pids-limit','128',
          '--memory','2g','--env','GIT_CONFIG_COUNT=1','--env','GIT_CONFIG_KEY_0=safe.directory',
          '--env','GIT_CONFIG_VALUE_0='+DEST,'--env','GIT_OPTIONAL_LOCKS=0',
          '--mount','type=bind,src='+str(TARGET)+',dst='+DEST,
          '--mount','type=bind,src='+str(TARGET/'.git')+',dst='+DEST+'/.git,readonly',
          '--mount','type=bind,src='+str(BRIDGE)+',dst=/opt/jarvis-bridge/bridge.py,readonly',
          '--mount','type=bind,src='+str(NEW_CONFIG)+',dst=/home/claude/.claude',
          image,'python3','/opt/jarvis-bridge/bridge.py']
    try:
        docker(*args,timeout=45)
        verify_worker()
    except Exception:
        print('WORKER_SETUP_FAILED_ATTEMPTING_SCOPED_CONTAINER_ROLLBACK')
        subprocess.run([DOCKER,'rm','-f',NAME],capture_output=True,timeout=25)
        raise

if __name__=='__main__':
    try: main()
    except Exception as e:
        print('SETUP_BLOCKED='+type(e).__name__+':'+str(e)[:200],file=sys.stderr)
        sys.exit(2)

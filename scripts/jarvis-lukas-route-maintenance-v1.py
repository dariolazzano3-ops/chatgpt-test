#!/usr/bin/python3
"""Install one tested routing fix through the existing private maintenance gate."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import urllib.request

SOURCE = Path('/home/jarvis/auto-project-routing-v1')
RUNTIME = Path('/opt/jarvis/chatgpt-test')
INBOX = Path('/home/jarvis/.jarvis-maintenance/pending.tgz')
BRANCH = 'factory/jarvis-capability-expansion-v3'
EXPECTED_OLD_ROUTER_SHA = '5617ab519b66da619b167ba1289bcf31f4e0a16b1dc5bb37130ea50a49162186'
FILES = {
    'src/jarvis/project-route-v1.js': '621fecca05c8b8ea970e225fd95b09ac1863f3fd73f63e9523cefccb408e71d1',
    'scripts/jarvis-project-route-separators-v1.test.mjs': '0cdac58acb0633fca921e7ea27f32bd5275f3b69a0294626d3d38a88a97c16b7'
}
MAINT = '/usr/local/sbin/jarvis-maintenance'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def run(args, timeout=180):
    p=subprocess.run(args,capture_output=True,text=True,timeout=timeout)
    if p.returncode: raise RuntimeError('COMMAND_FAILED_'+str(p.returncode)+':'+p.stderr[-300:])
    return p.stdout.strip()

def git(*args):
    return run(['/usr/sbin/runuser','-u','jarvis-operator','--','/usr/bin/git',
                '-c','safe.directory='+str(RUNTIME),'-C',str(RUNTIME),*args],timeout=25)

def status():
    d=json.loads(run(['/usr/bin/curl','-fsS','--max-time','5','--unix-socket',
      '/opt/jarvis/owner-deploy-queue/owner-control.sock','http://localhost/v1/status'],timeout=9))
    s=d.get('automatic_project_target_status') or {}
    if not d.get('core_online') or s.get('registry_revision')!=6 or s.get('registry_errors'):
        raise RuntimeError('LIVE_REGISTRY_NOT_HEALTHY')
    if not {'AURENTARA','JARVIS_AUTONOMY_TEST','LUKAS_PAFF'}.issubset(set(s.get('target_ids') or [])):
        raise RuntimeError('EXPECTED_PROJECTS_NOT_ALL_REGISTERED')
    return s

def main():
    if os.geteuid()!=0: raise RuntimeError('ROOT_CONSOLE_REQUIRED')
    status()
    if git('branch','--show-current')!=BRANCH: raise RuntimeError('RUNTIME_BRANCH_MISMATCH')
    if git('status','--porcelain'): raise RuntimeError('RUNTIME_NOT_CLEAN')
    base=git('rev-parse','HEAD')
    if sha(RUNTIME/'src/jarvis/project-route-v1.js')!=EXPECTED_OLD_ROUTER_SHA:
        raise RuntimeError('RUNTIME_ROUTER_ALREADY_CHANGED_REVIEW_REQUIRED')
    for name,expected in FILES.items():
        p=SOURCE/name
        if p.is_symlink() or not p.is_file() or sha(p)!=expected:
            raise RuntimeError('SOURCE_FILE_MISMATCH_'+name)
    if INBOX.exists() or INBOX.is_symlink(): raise RuntimeError('MAINTENANCE_QUEUE_BUSY')
    with tempfile.TemporaryDirectory(prefix='jarvis-lukas-route-',dir='/root') as tmp:
        stage=Path(tmp)
        (stage/'payload').mkdir()
        manifest={
          'schema':'jarvis-maintenance-bundle.v1',
          'target_branch':BRANCH,
          'expected_head':base,
          'commit_message':'fix(jarvis): support approved Lukas-Paff separator variants',
          'files':[],
          'checks':['scripts/jarvis-project-route-separators-v1.test.mjs',
                    'scripts/jarvis-remote-operator-server-v1-smoke.mjs',
                    'scripts/jarvis-owner-chat-job-v1-smoke.mjs']
        }
        for name,expected in FILES.items():
            dest=stage/'payload'/name
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_bytes((SOURCE/name).read_bytes())
            manifest['files'].append({'path':name,'sha256':expected})
        (stage/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        bundle=stage/'bundle.tgz'
        with tarfile.open(bundle,'w:gz') as t:
            t.add(stage/'manifest.json',arcname='manifest.json')
            t.add(stage/'payload',arcname='payload')
        with tarfile.open(bundle) as t:
            for name,expected in FILES.items():
                if hashlib.sha256(t.extractfile('payload/'+name).read()).hexdigest()!=expected:
                    raise RuntimeError('BUNDLE_INTEGRITY_FAILED')
        INBOX.write_bytes(bundle.read_bytes())
        os.chmod(INBOX,0o600)
        print('SCOPED_ROUTE_BUNDLE_READY',flush=True)
    try:
        result=run([MAINT,'install'],timeout=180)
    except BaseException:
        print('INSTALL_FAILED_REVIEW_MAINTENANCE_OUTPUT',flush=True)
        raise
    if 'MAINTENANCE_GATE_INSTALL_PASS' not in result:
        raise RuntimeError('MAINTENANCE_SUCCESS_ATTESTATION_MISSING')
    status()
    if sha(RUNTIME/'src/jarvis/project-route-v1.js')!=FILES['src/jarvis/project-route-v1.js']:
        raise RuntimeError('RUNTIME_ROUTER_SHA_NOT_UPDATED')
    code="""import {resolveJarvisAutomaticProjectRouteV1 as route} from 'file:///opt/jarvis/chatgpt-test/src/jarvis/project-route-v1.js';
import fs from 'node:fs';
const d=JSON.parse(fs.readFileSync('/opt/jarvis/owner-deploy-queue/project-targets.v1.json','utf8'));
const x=route('JARVIS, öffne das Lukas-Paff-Projekt und verbessere das mobile Design',d.targets);
if(x.target_id!=='LUKAS_PAFF') process.exit(16);
console.log('LIVE_ROUTER_MATCH_PASS');
"""
    out=run(['/usr/sbin/runuser','-u','jarvis-operator','--','/usr/bin/node',
            '--input-type=module','-e',code],timeout=20)
    if 'LIVE_ROUTER_MATCH_PASS' not in out:raise RuntimeError('LIVE_ROUTE_NOT_ATTESTED')
    print('ROUTE_INSTALL_PASS',flush=True)
    print('ORIGINAL_PROJECTS_REMAIN_ACTIVE',flush=True)
    print('NO_MODEL_CALL_NO_PUBLIC_DEPLOY',flush=True)

if __name__=='__main__':
    try: main()
    except Exception as e:
        print('ROUTE_INSTALL_BLOCKED='+type(e).__name__+':'+str(e)[:180],file=sys.stderr)
        sys.exit(2)

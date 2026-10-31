#!/usr/bin/python3
"""Scoped JARVIS OpenAI API fallback authorization: <= $0.25 per job.

Does not purchase credits, perform API calls, modify Hermes settings, or deploy
public services. Requires authorized root console for the protected env file.
"""
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile

ENV = Path('/etc/jarvis/remote-operator.env')
MAINT = '/usr/local/sbin/jarvis-maintenance'
KEYS = {
    'JARVIS_AI_API_FALLBACK_ENABLED':'true',
    'JARVIS_AI_API_FALLBACK_APPROVED':'true',
    'JARVIS_AI_MAX_JOB_COST_USD':'0.25'
}
MAX_USD=0.25

def patched_env(raw):
    """Never echo, log or parse secret values. Preserve all unrelated keys."""
    lines=raw.splitlines(keepends=True)
    for key in KEYS:
        matches=[i for i,line in enumerate(lines)
                 if re.match(r'^\s*'+re.escape(key)+r'\s*=',line)]
        if len(matches)>1:
            raise RuntimeError('DUPLICATE_KEY_'+key)
        if matches:
            i=matches[0]
            suffix='\n' if lines[i].endswith('\n') else ''
            lines[i]=key+'='+KEYS[key]+suffix
        else:
            if lines and not lines[-1].endswith('\n'):
                lines[-1]+='\n'
            lines.append(key+'='+KEYS[key]+'\n')
    return ''.join(lines)

def verify_input(raw):
    matches=re.findall(r'^\s*OPENAI_API_KEY\s*=\s*(\S.*?)\s*$',raw,re.M)
    if len(matches)!=1:
        raise RuntimeError('OPENAI_API_KEY_MISSING_OR_AMBIGUOUS')
    secret=matches[0].strip().strip('"').strip("'")
    if not secret.startswith('sk-') or len(secret)<20:
        raise RuntimeError('OPENAI_API_KEY_NOT_CONFIGURED')
    return True

def exec_cmd(args,timeout=100):
    return subprocess.run(args,text=True,capture_output=True,timeout=timeout)

def owner_status():
    p=exec_cmd(['/usr/bin/curl','-fsS','--max-time','5',
                '--unix-socket','/opt/jarvis/owner-deploy-queue/owner-control.sock',
                'http://localhost/v1/status'],timeout=8)
    if p.returncode:
        raise RuntimeError('OWNER_SOCKET_UNAVAILABLE')
    value=json.loads(p.stdout)
    if value.get('core_online') is not True:
        raise RuntimeError('JARVIS_NOT_ONLINE')
    return value

def write_atomic(data,original_stat):
    fd,name=tempfile.mkstemp(prefix='.jarvis-budget-',dir=str(ENV.parent))
    try:
        with os.fdopen(fd,'w') as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
            os.fchmod(output.fileno(),stat.S_IMODE(original_stat.st_mode))
            os.fchown(output.fileno(),original_stat.st_uid,original_stat.st_gid)
        os.replace(name,ENV)
    finally:
        if os.path.exists(name): os.unlink(name)

def check_live_settings():
    pid=exec_cmd(['/usr/bin/systemctl','show','-p','MainPID','--value',
                  'jarvis-remote-operator.service'],timeout=8).stdout.strip()
    if not pid.isdigit() or int(pid)<=0:
        raise RuntimeError('JARVIS_PID_UNAVAILABLE')
    # inspect only named non-secret settings; do not print raw environment.
    values={}
    for entry in Path('/proc/'+pid+'/environ').read_bytes().split(b'\x00'):
        if b'=' not in entry: continue
        name,value=entry.split(b'=',1)
        if name.decode(errors='ignore') in KEYS:
            values[name.decode()]=value.decode(errors='replace')
    if values != KEYS:
        raise RuntimeError('LIVE_BUDGET_SETTINGS_NOT_APPLIED')
    owner_status()
    return True

def apply():
    if os.geteuid()!=0: raise RuntimeError('AUTHORIZED_ROOT_CONSOLE_REQUIRED')
    if not ENV.is_file() or ENV.is_symlink():
        raise RuntimeError('PROTECTED_ENV_NOT_REGULAR_FILE')
    original=ENV.read_text()
    verify_input(original)
    owner_status()
    updated=patched_env(original)
    if updated==original:
        check_live_settings()
        print('JARVIS_API_AUTO_APPROVAL_ALREADY_ACTIVE',flush=True)
        return
    old_stat=ENV.stat()
    try:
        write_atomic(updated,old_stat)
        p=exec_cmd([MAINT,'restart'],timeout=130)
        if p.returncode or 'MAINTENANCE_RESTART_PASS' not in p.stdout:
            raise RuntimeError('JARVIS_CONTROLLED_RESTART_FAILED')
        check_live_settings()
    except BaseException:
        write_atomic(original,old_stat)
        p=exec_cmd([MAINT,'restart'],timeout=130)
        print('API_POLICY_ROLLBACK_'+('PASS' if p.returncode==0 else 'NEEDS_CHECK'),flush=True)
        raise
    print('JARVIS_OPENAI_API_AUTO_FALLBACK_ENABLED',flush=True)
    print('MAX_PER_JOB_USD=0.25',flush=True)
    print('ABOVE_LIMIT_REQUIRES_SEPARATE_APPROVAL',flush=True)
    print('NO_API_CALL_NO_PURCHASE_NO_PUBLIC_DEPLOY',flush=True)

if __name__=='__main__':
    try: apply()
    except Exception as e:
        print('JARVIS_API_POLICY_BLOCKED='+type(e).__name__+':'+str(e)[:150],file=sys.stderr)
        sys.exit(2)

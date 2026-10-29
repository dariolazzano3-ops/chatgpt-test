#!/usr/bin/env python3
"""Owner-run bootstrap. No runtime mutation, restart, install grant or daemon."""
import hashlib
import json
import os
from pathlib import Path
import pwd
import shutil
import stat
import subprocess
import tempfile

HELPER = json.loads(r'''"#!/usr/bin/python3 -I\n\"\"\"Fixed read-only runtime interface; installed root-owned, run as operator.\"\"\"\nimport json\nimport os\nimport pwd\nimport subprocess\nimport sys\n\nREPO = '/opt/jarvis/chatgpt-test'\nENV = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8',\n       'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null',\n       'GIT_TERMINAL_PROMPT': '0', 'GIT_OPTIONAL_LOCKS': '0'}\n\ndef git(*args):\n    return subprocess.run(['/usr/bin/git', '-C', REPO, *args],\n                          env=ENV, check=True, capture_output=True, timeout=30).stdout\n\ndef main(argv):\n    if argv not in (['status'], ['source']):\n        raise SystemExit('Only exact status or source is permitted')\n    if os.geteuid() != pwd.getpwnam('jarvis-operator').pw_uid:\n        raise SystemExit('Run only as jarvis-operator')\n    head = git('rev-parse', 'HEAD').decode().strip()\n    dirty = git('status', '--porcelain=v1', '--untracked-files=normal')\n    if argv == ['status']:\n        print(json.dumps({'head': head,\n                          'branch': git('branch', '--show-current').decode().strip(),\n                          'dirty_lines': len(dirty.splitlines()),\n                          'read_only': True}))\n    else:\n        if dirty:\n            raise SystemExit('Runtime is dirty; committed-only export refused')\n        data = git('archive', '--format=tar', head, 'src', 'scripts', 'package.json')\n        sys.stdout.buffer.write(data)\n\nif __name__ == '__main__':\n    main(sys.argv[1:])\n"''')
DEST = Path('/usr/local/bin/jarvis-runtime-read')
RULE = Path('/etc/sudoers.d/jarvis-runtime-read')
POLICY = ('# Fixed read-only JARVIS commands; no root or arbitrary arguments.\n'
          'jarvis ALL=(jarvis-operator) NOPASSWD: /usr/local/bin/jarvis-runtime-read status, /usr/local/bin/jarvis-runtime-read source\n')
ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LANG': 'C.UTF-8'}

def trusted_dir(path):
    for p in [path, *path.parents]:
        s = p.lstat()
        if not stat.S_ISDIR(s.st_mode) or s.st_uid != 0 or s.st_mode & 0o022:
            raise RuntimeError('Unsafe root-owned destination directory: ' + str(p))

def existing_ok(path, content, mode):
    if not path.exists() and not path.is_symlink():
        return False
    s = path.lstat()
    if not stat.S_ISREG(s.st_mode) or s.st_uid != 0 or stat.S_IMODE(s.st_mode) != mode or path.read_text() != content:
        raise RuntimeError('Conflicting existing file, refusing overwrite: ' + str(path))
    return True

def create_atomic(path, content, mode):
    fd, name = tempfile.mkstemp(prefix='.jarvis-setup-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
            os.fchmod(f.fileno(), mode)
        # Hard link creates final destination only if it does not exist.
        os.link(name, path)
    finally:
        os.unlink(name)

def main():
    if os.geteuid() != 0:
        raise SystemExit('Run this setup once from your authenticated root console')
    owner = pwd.getpwnam('jarvis')
    pwd.getpwnam('jarvis-operator')
    for path in (DEST.parent, RULE.parent):
        trusted_dir(path)
    for binary in ('/usr/sbin/visudo', '/usr/sbin/runuser', '/usr/bin/sudo', '/usr/bin/python3'):
        if not Path(binary).is_file():
            raise RuntimeError('Required binary missing: ' + binary)
    have_dest = existing_ok(DEST, HELPER, 0o755)
    have_rule = existing_ok(RULE, POLICY, 0o440)
    subprocess.run(['/usr/sbin/visudo', '-c'], check=True, env=ENV, capture_output=True)
    # Export only the two fixed maintenance programs for review, never secrets.
    audit = Path(tempfile.mkdtemp(prefix='jarvis-maintenance-review-', dir='/var/tmp'))
    for source in (Path('/usr/local/sbin/jarvis-maintenance'),
                   Path('/usr/local/libexec/jarvis-maintenance-worker')):
        s = source.lstat()
        if not stat.S_ISREG(s.st_mode) or s.st_uid != 0 or s.st_mode & 0o022 or s.st_size > 2000000:
            raise RuntimeError('Unsafe maintenance source: ' + str(source))
        data = source.read_bytes()
        data.decode('utf-8')
        target = audit / source.name
        target.write_bytes(data)
        target.chmod(0o600)
        os.chown(target, owner.pw_uid, owner.pw_gid)
    made = []
    try:
        if not have_dest:
            create_atomic(DEST, HELPER, 0o755)
            made.append(DEST)
        if not have_rule:
            create_atomic(RULE, POLICY, 0o440)
            made.append(RULE)
        subprocess.run(['/usr/sbin/visudo', '-c'], check=True, env=ENV, capture_output=True)
        result = subprocess.run(['/usr/sbin/runuser', '-u', 'jarvis', '--',
                                 '/usr/bin/sudo', '-n', '-u', 'jarvis-operator',
                                 str(DEST), 'status'],
                                check=True, env=ENV, capture_output=True, text=True, timeout=40)
        state = json.loads(result.stdout)
        (audit / 'runtime-status.json').write_text(json.dumps(state, indent=2) + '\n')
        (audit / 'runtime-status.json').chmod(0o600)
        os.chown(audit / 'runtime-status.json', owner.pw_uid, owner.pw_gid)
        # Export through the new fixed interface, so no additional console step is needed.
        result = subprocess.run(['/usr/sbin/runuser', '-u', 'jarvis', '--',
                                 '/usr/bin/sudo', '-n', '-u', 'jarvis-operator',
                                 str(DEST), 'source'],
                                check=True, env=ENV, capture_output=True, timeout=40)
        (audit / 'runtime-source.tar').write_bytes(result.stdout)
        (audit / 'runtime-source.tar').chmod(0o600)
        os.chown(audit / 'runtime-source.tar', owner.pw_uid, owner.pw_gid)
        os.chown(audit, owner.pw_uid, owner.pw_gid)
    except BaseException:
        for path in reversed(made):
            path.unlink()
        shutil.rmtree(audit)
        raise
    print('READ_GATE_READY')
    print('REVIEW_DIR=' + str(audit))
    print('RUNTIME_HEAD=' + state['head'])
    print('NO_RUNTIME_CHANGE_NO_RESTART_NO_MODEL_CALL')
    print('INSTALL_PERMISSION_NOT_ADDED')
    print('Tool policy is separate; Desktop Commander invocation remains to be verified.')

if __name__ == '__main__':
    main()

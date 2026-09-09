"""Internal stdlib HTTP worker. The deployment container is the outer sandbox."""
import hmac
import json
import os
import threading
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import bridge

LOCK = threading.Lock()
MAX_BODY = 100000
MAX_OUTPUT = 2 * 1024 * 1024
TIMEOUT = 900


def validate_tree(workspace):
    workspace = Path(workspace)
    if not workspace.is_dir() or any(p.is_symlink() for p in [workspace, *workspace.parents]):
        raise ValueError('unsafe workspace')
    count = size = 0
    for directory, dirs, files in os.walk(workspace, followlinks=False):
        for name in dirs + files:
            p = Path(directory) / name
            count += 1
            st = p.lstat()
            if name == '.git' or p.is_symlink() or (not p.is_dir() and not p.is_file()) or st.st_nlink > 1 and p.is_file():
                raise ValueError('unsafe tree')
            size += st.st_size if p.is_file() else 0
            if count > bridge.WORKSPACE_MAX_ENTRIES or size > bridge.WORKSPACE_MAX_BYTES:
                raise ValueError('workspace too large')
    summary = bridge.workspace_snapshot(workspace)['summary']
    if not summary['complete']:
        raise ValueError('incomplete workspace snapshot')
    return summary


def workspace_for(root, job_id):
    if not bridge.valid_job_id(job_id):
        raise ValueError('invalid job id')
    root = Path(root)
    if not root.is_dir() or any(p.is_symlink() for p in [root, *root.parents]):
        raise ValueError('unsafe exchange root')
    if {p.name for p in root.iterdir()} != {job_id}:
        raise ValueError('foreign exchange entries')
    job = root / job_id
    if job.is_symlink() or not job.is_dir() or {p.name for p in job.iterdir()} != {'workspace'}:
        raise ValueError('unsafe job directory')
    ws = job / 'workspace'
    validate_tree(ws)
    return ws


def parse_audit(stdout, workspace):
    """Validate the known Codex JSON lifecycle, retaining structural evidence only.

    Command text is not a path-security mechanism. The outer Docker sandbox
    and exchange confinement remain the security boundary.
    """
    counts = {}
    item_counts = {}
    commands = {}
    completed = False
    exit_zero = True

    def strict_object(pairs):
        obj = {}
        for key, value in pairs:
            if key in obj:
                raise ValueError('duplicate JSON key')
            obj[key] = value
        return obj

    def invalid_constant(value):
        raise ValueError('non-JSON constant')

    try:
        for line in stdout.splitlines():
            e = json.loads(line, object_pairs_hook=strict_object,
                           parse_constant=invalid_constant)
            if not isinstance(e, dict) or completed:
                raise ValueError()
            t = e.get('type')
            if t not in ('thread.started', 'turn.started', 'item.started',
                         'item.completed', 'turn.completed'):
                raise ValueError()
            counts[t] = counts.get(t, 0) + 1
            if t == 'thread.started':
                if counts[t] != 1 or len(counts) != 1 or not isinstance(e.get('thread_id'), str) or not e['thread_id']:
                    raise ValueError()
            elif counts.get('thread.started') != 1:
                raise ValueError()
            elif t == 'turn.started':
                if any(not done for done in commands.values()):
                    raise ValueError()
            elif not counts.get('turn.started'):
                raise ValueError()
            elif t == 'turn.completed':
                if not isinstance(e.get('usage'), dict):
                    raise ValueError()
                completed = True
            else:
                item = e.get('item')
                if not isinstance(item, dict):
                    raise ValueError()
                kind = item.get('type')
                if kind not in ('agent_message', 'command_execution'):
                    raise ValueError()
                item_counts[kind] = item_counts.get(kind, 0) + 1
                if kind == 'agent_message':
                    if not isinstance(item.get('text'), str):
                        raise ValueError()
                else:
                    item_id = item.get('id')
                    if not isinstance(item_id, str) or not item_id:
                        raise ValueError()
                    if t == 'item.started':
                        if item_id in commands or item.get('status') != 'in_progress' or 'exit_code' not in item or item['exit_code'] is not None:
                            raise ValueError()
                        commands[item_id] = False
                    else:
                        if item_id not in commands or commands[item_id]:
                            raise ValueError()
                        if item.get('status') != 'completed' or type(item.get('exit_code')) is not int or item['exit_code'] != 0:
                            exit_zero = False
                            raise ValueError()
                        commands[item_id] = True
        valid = (counts.get('thread.started') == 1
                 and counts.get('turn.started', 0) >= 1 and completed
                 and all(commands.values()))
    except (ValueError, TypeError, KeyError, RecursionError):
        valid = False
    return {'complete': valid, 'compliant': valid, 'event_counts': counts,
            'item_type_counts': item_counts, 'command_count': len(commands),
            'all_commands_completed': all(commands.values()),
            'all_commands_exit_zero': exit_zero and all(commands.values()),
            'schema': 'codex-json-v1-strict'}


def run_process(cmd, ws, timeout, env):
    """Drain bounded binary streams without unbounded communicate buffers."""
    import selectors
    import signal
    import subprocess
    import time
    proc = subprocess.Popen(cmd, cwd=str(ws), env=env, stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            start_new_session=True)
    selector = selectors.DefaultSelector()
    output = [bytearray(), bytearray()]
    expired = False
    deadline = time.monotonic() + timeout
    try:
        for index, pipe in enumerate((proc.stdout, proc.stderr)):
            selector.register(pipe, selectors.EVENT_READ, index)
        while selector.get_map():
            if time.monotonic() >= deadline:
                expired = True
                break
            for key, _ in selector.select(min(0.1, max(0, deadline - time.monotonic()))):
                chunk = os.read(key.fileobj.fileno(), 65536)
                if not chunk:
                    selector.unregister(key.fileobj)
                else:
                    if sum(map(len, output)) + len(chunk) > MAX_OUTPUT:
                        raise ValueError('output limit')
                    output[key.data].extend(chunk)
        if not expired:
            try:
                proc.wait(timeout=max(0.001, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                expired = True
    finally:
        # Kill the group even if the leader exited and closed its streams.
        term_ok = bridge._signal_claude_group(proc.pid, signal.SIGTERM)
        try:
            proc.wait(timeout=1)
        except subprocess.TimeoutExpired:
            pass
        kill_ok = bridge._signal_claude_group(proc.pid, signal.SIGKILL)
        try:
            proc.wait(timeout=5)
        finally:
            selector.close()
            proc.stdout.close()
            proc.stderr.close()
        if not term_ok or not kill_ok:
            raise ValueError('process lifecycle failure')
    return bridge.ClaudeRun(stdout=output[0].decode('utf-8'), stderr=output[1].decode('utf-8'),
        returncode=proc.returncode, timed_out=expired, term_signalled=True, killed=True, pid=proc.pid)


def run_job(data):
    if not isinstance(data, dict) or set(data) != {'job_id', 'mode', 'prompt'}:
        raise ValueError('invalid request')
    if not bridge.valid_job_id(data['job_id']) or data['mode'] not in ('review', 'implement'):
        raise ValueError('invalid job or mode')
    if not isinstance(data['prompt'], str) or not 0 < len(data['prompt']) <= bridge.MAX_PROMPT_CHARS:
        raise ValueError('invalid prompt')
    with LOCK:
        root = os.environ.get('JARVIS_CODEX_EXCHANGE_ROOT', '/exchange')
        ws = workspace_for(root, data['job_id'])
        pre = validate_tree(ws)
        outcome = {'job_id': data['job_id'], 'ok': False, 'exit_code': None,
                   'timed_out': False, 'audit': {'complete': False, 'compliant': False}}
        try:
            cmd = [os.environ.get('JARVIS_CODEX_BIN', '/home/claude/.claude/codex-worker/bin/codex'),
                   'exec', '--json', '--skip-git-repo-check', '--sandbox', 'danger-full-access',
                   '-c', 'approval_policy="never"', '--', data['prompt']]
            env = {k: v for k, v in os.environ.items() if k in
                   ('PATH', 'HOME', 'CODEX_HOME', 'LANG', 'LC_ALL', 'TMPDIR')}
            run = run_process(cmd, ws, TIMEOUT, env)
            workspace_for(root, data['job_id'])
            post = validate_tree(ws)
            audit = parse_audit(run.stdout, ws)
            outcome.update(exit_code=run.returncode, timed_out=run.timed_out,
                           audit=audit, fs_pre=pre, fs_post=post)
            outcome['ok'] = (run.returncode == 0 and not run.timed_out and audit['compliant']
                             and len(run.stdout) + len(run.stderr) <= MAX_OUTPUT
                             and (data['mode'] != 'review' or pre == post))
            # Streams can contain prompts or credentials: capture in memory only.
        except Exception:
            outcome['error'] = 'WORKER_FAILED_CLOSED'
        return outcome


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        bridge.response(self, 200 if self.path == '/health' else 404,
                        {'ok': self.path == '/health', 'service': 'codex-worker'})

    def do_POST(self):
        token = os.environ.get('JARVIS_CODEX_WORKER_TOKEN', '')
        if not token or not hmac.compare_digest(self.headers.get('Authorization', '').encode(), ('Bearer ' + token).encode()):
            return bridge.response(self, 401, {'ok': False})
        if self.path != '/v1/run':
            return bridge.response(self, 404, {'ok': False})
        try:
            self.connection.settimeout(10)
            n = int(self.headers.get('Content-Length', '0'))
            if not 0 < n <= MAX_BODY or self.headers.get('Transfer-Encoding'):
                raise ValueError()
            data = json.loads(self.rfile.read(n))
            result = run_job(data)
        except Exception:
            return bridge.response(self, 400, {'ok': False, 'error': 'INVALID_REQUEST'})
        bridge.response(self, 200, result)


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('JARVIS_CODEX_WORKER_PORT', '8790'))), Handler).serve_forever()

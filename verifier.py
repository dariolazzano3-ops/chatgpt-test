"""Read-only verification of persisted Bridge evidence and current truth.

Fail-closed: a malformed bundle, a mutated source, a missing repository, or an
invalid Runtime Truth all still reject. This module adds two operator aids that
do NOT weaken any invariant:

  * the exact failing invariant is reported (not just "ValueError"), with the
    operand values for path/identity checks (``--verbose``);
  * an explicit, operator-asserted mount-prefix remap (``--path-remap OLD=NEW``,
    repeatable; ``--was``/``--now`` kept as a deprecated alias). Absolute
    prefixes only; no wildcard, no ``..``; at most one remap may match a given
    recorded path; exact equality is still required after remapping. Source
    identity continues to rest on authoritative evidence - git HEAD, filesystem
    and state digests, Runtime Truth pre/post, repository identity and source
    immutability - never on the recorded path string alone.
"""
import argparse
import json
import os
from pathlib import Path
import bridge


class VerifierRejected(ValueError):
    """Raised when an invariant fails. ``reason`` is the exact invariant name;
    ``detail`` carries the operands for path/identity checks."""

    def __init__(self, reason, detail=None):
        super().__init__(reason)
        self.reason = reason
        self.detail = detail or {}


def _git_allow_readonly(*paths):
    """Let git read these specific evidence repositories even when they are owned
    by another user - e.g. the service UID that produced the bundle - while an
    operator runs this check under a different identity.

    Strictly read-only: no write access, no hooks; scoped to git subprocesses via
    the environment. Ownership and permissions are never modified. Every
    immutability assertion below is unchanged - a mutated source still differs on
    HEAD / status / filesystem-delta, and a genuinely unreadable or non-repo path
    still yields ``is_repo`` False and 'source git unavailable'.
    """
    try:
        n = int(os.environ.get('GIT_CONFIG_COUNT', '0'))
    except ValueError:
        n = 0
    for p in paths:
        os.environ['GIT_CONFIG_KEY_%d' % n] = 'safe.directory'
        os.environ['GIT_CONFIG_VALUE_%d' % n] = str(Path(p).resolve())
        n += 1
    os.environ['GIT_CONFIG_COUNT'] = str(n)


def _normalise_pairs(path_remap):
    """Accept a single (old, new) tuple or an iterable of them; validate each.

    Rejected outright (raises VerifierRejected):
      * a root / wildcard old-prefix ('', '/', '.', '..', '*')
      * a relative old or new prefix
      * a '..' traversal component in old or new
    These would let an operator assert an arbitrary identity, which is exactly
    what this check exists to prevent.
    """
    if not path_remap:
        return []
    if isinstance(path_remap, tuple) and len(path_remap) == 2 and isinstance(path_remap[0], str):
        pairs = [path_remap]
    else:
        pairs = list(path_remap)
    out = []
    for old, new in pairs:
        old_s, new_s = str(old), str(new)
        if old_s.strip() in ('', '/', '.', '..', '*') or new_s.strip() in ('', '.', '..'):
            raise VerifierRejected('invalid path remap', {'old': old_s, 'new': new_s,
                                                          'why': 'root/wildcard/empty prefix'})
        if not old_s.startswith('/') or not new_s.startswith('/'):
            raise VerifierRejected('invalid path remap', {'old': old_s, 'new': new_s,
                                                          'why': 'prefixes must be absolute'})
        if '..' in Path(old_s).parts or '..' in Path(new_s).parts:
            raise VerifierRejected('invalid path remap', {'old': old_s, 'new': new_s,
                                                          'why': 'traversal component'})
        out.append((old_s.rstrip('/'), new_s.rstrip('/')))
    return out


def _remap(recorded, pairs):
    """Apply operator-asserted mount-prefix remap(s) to a recorded path string.
    Exactly one pair may match; two matching pairs with differing results is an
    ambiguous assertion and rejects. After remap, exact equality is still
    required by the caller (no fuzzy / suffix matching)."""
    if not pairs:
        return recorded
    s = str(recorded)
    hits = []
    for old, new in pairs:
        if s == old:
            hits.append(new)
        elif s.startswith(old + '/'):
            hits.append(new + '/' + s[len(old) + 1:])
    distinct = list(dict.fromkeys(hits))
    if len(distinct) > 1:
        raise VerifierRejected('ambiguous path remap',
                               {'recorded': s, 'candidates': distinct})
    result = distinct[0] if distinct else recorded
    if '..' in Path(result).parts:
        raise VerifierRejected('path traversal in remap result',
                               {'recorded': s, 'result': result})
    return result


def verify(job_dir, source, *, path_remap=None):
    # Git status must not refresh the source index.
    os.environ['GIT_OPTIONAL_LOCKS'] = '0'
    path_remap = _normalise_pairs(path_remap)      # validates; may raise VerifierRejected
    job = Path(job_dir).resolve()
    source = Path(source).resolve()
    # The evidence repos may be owned by the service UID that produced them;
    # allow this read-only check to run under any operator identity.
    _git_allow_readonly(job, job / 'workspace', source)
    state = bridge.read_json(job / 'state.json')
    result = bridge.read_json(job / 'result.json')

    def require(condition, reason, detail=None):
        if not condition:
            raise VerifierRejected(reason, detail() if callable(detail) else detail)

    require(state['status'] == result['status'] == 'COMPLETE' and result['ok'] is True, 'not complete',
            {'state_status': state.get('status'), 'result_status': result.get('status'), 'ok': result.get('ok')})
    require(state['job_id'] == result['job_id'] == job.name and bridge.valid_job_id(job.name), 'job identity',
            {'state_job_id': state.get('job_id'), 'result_job_id': result.get('job_id'), 'dir_name': job.name})
    rt = result['runtime_truth']
    require(isinstance(rt, dict), 'runtime truth')
    count = rt['fallback_attempt_count']
    attempted = rt['fallback_attempted']
    require(type(count) is int and count in (0, 1) and type(attempted) is bool and count == int(attempted), 'attempt count',
            {'fallback_attempt_count': count, 'fallback_attempted': attempted})
    require(rt['primary_worker'] == 'claude', 'primary worker', {'primary_worker': rt.get('primary_worker')})
    require(rt['final_worker'] == ('codex' if attempted else 'claude'), 'final worker',
            {'final_worker': rt.get('final_worker'), 'attempted': attempted})
    require(rt['fallback_worker'] == ('codex' if attempted else None), 'fallback worker',
            {'fallback_worker': rt.get('fallback_worker'), 'attempted': attempted})
    require((isinstance(rt['fallback_reason'], str) and bool(rt['fallback_reason'])) if attempted else rt['fallback_reason'] is None,
            'fallback reason', {'fallback_reason': rt.get('fallback_reason'), 'attempted': attempted})
    w = result['workspace_evidence']
    require(w['isolated'] is True and w['changes_promoted_to_source'] is False, 'promotion',
            {'isolated': w.get('isolated'), 'changes_promoted_to_source': w.get('changes_promoted_to_source')})
    recorded_src = _remap(w['source_project_path'], path_remap)
    require(Path(recorded_src).resolve() == source, 'source path',
            {'recorded': w['source_project_path'], 'recorded_after_remap': recorded_src,
             'expected': str(source), 'path_remap': path_remap})
    current = bridge.git_state(source)
    require(current['is_repo'] and current['error'] is None, 'source git unavailable',
            {'is_repo': current.get('is_repo'), 'error': current.get('error'), 'source': str(source), 'euid': os.geteuid()})
    require(current == w['source_git_post'] == w['source_git_pre'], 'source git changed',
            {'current_head': current.get('head'), 'pre_head': (w.get('source_git_pre') or {}).get('head'),
             'post_head': (w.get('source_git_post') or {}).get('head'),
             'current_status': current.get('status'), 'pre_status': (w.get('source_git_pre') or {}).get('status')})
    require(rt['source_head_pre'] == rt['source_head_post'] == current['head'], 'source head',
            {'rt_pre': rt.get('source_head_pre'), 'rt_post': rt.get('source_head_post'), 'current': current.get('head')})
    require(rt['source_unchanged'] is True and w['source_unchanged'] is True, 'source changed',
            {'rt_source_unchanged': rt.get('source_unchanged'), 'w_source_unchanged': w.get('source_unchanged')})
    fs = bridge.workspace_snapshot(source)['summary']
    delta = w['source_filesystem_delta']
    require(fs['complete'] and delta['complete'] and delta['unchanged'] and fs == delta['post'] == delta['pre'],
            'source filesystem changed',
            {'fs_complete': fs.get('complete'), 'delta_complete': delta.get('complete'),
             'delta_unchanged': delta.get('unchanged'), 'fs_sha': fs.get('sha256'),
             'delta_post_sha': (delta.get('post') or {}).get('sha256')})
    git = result['git_evidence']
    delta = result['filesystem_evidence']
    require(delta['complete'] is True and result['exit_code'] == 0 and result['timed_out'] is False and result['failure'] is None,
            'result evidence',
            {'delta_complete': delta.get('complete'), 'exit_code': result.get('exit_code'),
             'timed_out': result.get('timed_out'), 'failure': result.get('failure')})
    require(result['tool_audit']['complete'] is True and result['tool_audit']['compliant'] is True, 'audit',
            {'tool_audit': result.get('tool_audit')})
    for phase in ('pre', 'post'):
        require(rt['workspace_head_' + phase] == git[phase]['head'], 'workspace head evidence',
                {'phase': phase, 'rt': rt.get('workspace_head_' + phase), 'git': (git.get(phase) or {}).get('head')})
        digest = rt['workspace_fs_' + phase + '_sha256']
        require(isinstance(digest, str) and len(digest) == 64 and digest == delta[phase]['sha256'],
                'workspace filesystem evidence',
                {'phase': phase, 'rt_digest': digest, 'delta_digest': (delta.get(phase) or {}).get('sha256')})
    require(state['evidence']['source_git'] == w['source_git_pre'] and state['evidence']['post_git'] == git['post'] and state['evidence']['fs_delta'] == delta,
            'state evidence')
    ws = Path(_remap(w['execution_workspace_path'], path_remap))
    require(ws == job / 'workspace' and not ws.is_symlink(), 'workspace confinement',
            {'recorded': w['execution_workspace_path'], 'recorded_after_remap': str(ws),
             'expected': str(job / 'workspace'), 'path_remap': path_remap})
    if ws.exists():
        require(bridge.git_state(ws) == git['post'], 'workspace git changed')
        require(bridge.workspace_snapshot(ws)['summary'] == delta['post'] and not bridge._symlink_escapes(ws), 'workspace changed')
    if attempted:
        evidence = bridge.read_json(job / 'codex_result.json')
        require(evidence['job_id'] == job.name and evidence['ok'] is True and evidence['audit'] == result['tool_audit'],
                'fallback evidence',
                {'codex_job_id': evidence.get('job_id'), 'codex_ok': evidence.get('ok'),
                 'codex_audit': evidence.get('audit'), 'result_tool_audit': result.get('tool_audit')})
    if result['mode'] == 'review':
        require(delta['unchanged'] is True, 'review mutation', {'delta_unchanged': delta.get('unchanged')})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--job-dir', required=True)
    parser.add_argument('--source', required=True)
    parser.add_argument('--path-remap', action='append', default=[], metavar='OLD=NEW',
                        help='remap a mount prefix recorded in the evidence to its path on '
                             'this host (absolute; repeatable; no wildcard/traversal). '
                             'Exact equality is still required after remapping.')
    parser.add_argument('--was', help='deprecated alias: OLD prefix (use --path-remap OLD=NEW)')
    parser.add_argument('--now', help='deprecated alias: NEW prefix (use --path-remap OLD=NEW)')
    parser.add_argument('-v', '--verbose', action='store_true',
                        help='on rejection, also print the failing invariant operands')
    args = parser.parse_args()
    if bool(args.was) != bool(args.now):
        print('VERIFIER_REJECTED: --was and --now must be given together')
        return 2
    pairs = []
    for spec in args.path_remap:
        if spec.count('=') != 1:
            print('VERIFIER_REJECTED: --path-remap must be exactly OLD=NEW')
            return 2
        old, new = spec.split('=', 1)
        pairs.append((old, new))
    if args.was:
        pairs.append((args.was, args.now))
    remap = pairs or None
    try:
        verify(args.job_dir, args.source, path_remap=remap)
    except VerifierRejected as error:
        print('VERIFIER_REJECTED: ' + error.reason)
        if args.verbose and error.detail:
            print(json.dumps({'invariant': error.reason, 'operands': error.detail},
                             indent=2, default=str))
        return 1
    except Exception as error:  # noqa: BLE001 - surface, do not swallow
        print('VERIFIER_REJECTED: %s: %s' % (type(error).__name__, error))
        return 1
    print('VERIFIER_ACCEPTED')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

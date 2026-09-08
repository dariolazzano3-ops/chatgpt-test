import hashlib
import hmac
import json
import os
import queue
import re
import secrets
import stat
import subprocess
import tempfile
import threading
import time
import traceback
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "0.0.0.0"
PORT = 8788
ROOT = Path("/workspace/projects").resolve()
TOKEN_FILE = Path("/home/claude/.claude/bridge_token")

# Global execution lock. Preserves the V4 invariant that implementation work
# (and any bridge PRE/RUN/POST evidence sequence) cannot race through the same
# protected execution path. The V5 async worker is single-threaded and also
# takes this lock, so at most one Claude job executes at a time.
LOCK = threading.Lock()

SNAPSHOT_MAX_ENTRIES = 100000
SNAPSHOT_MAX_BYTES = 512 * 1024 * 1024
DELTA_PATH_LIMIT = 1000

# ---------------------------------------------------------------------------
# V5 async job system configuration
# ---------------------------------------------------------------------------

BRIDGE_VERSION = 5

# Production job store. Provided as a persistent mounted volume at runtime.
# Overridable for local testing via JARVIS_BRIDGE_JOBS_DIR, defaulting safely
# to the production path.
DEFAULT_JOBS_DIR = "/opt/jarvis-bridge/jobs"

DEFAULT_CLAUDE_TIMEOUT = 900

# Upper bound on the number of jobs that may be QUEUED or RUNNING at once.
# Bounds resource use and keeps the async model understandable.
MAX_ACTIVE_JOBS = 32

MAX_BODY_BYTES = 50000
MAX_PROMPT_CHARS = 20000

# Job status vocabulary with explicit semantics.
QUEUED = "QUEUED"       # persisted, PRE evidence not yet taken, not started
RUNNING = "RUNNING"     # worker has begun PRE evidence / Claude execution
COMPLETE = "COMPLETE"   # Claude finished AND all bridge verification passed
FAILED = "FAILED"       # non-zero exit, timeout, exception, failed verification,
                        # or fail-closed recovery of an orphaned job
TERMINAL_STATUSES = {COMPLETE, FAILED}

ORPHAN_REASON = "ORPHANED_BRIDGE_RESTART"

_JOB_ID_RE = re.compile(r"\A[0-9a-f]{32}\Z")

# Work queue + single background worker thread.
WORK_Q: "queue.Queue" = queue.Queue()
_worker_started = False
_worker_lock = threading.Lock()

# Serializes read-modify-write of an individual job's state.json.
STATE_LOCK = threading.Lock()

try:
    _FILE_TOKEN = TOKEN_FILE.read_text().strip() or None
except OSError:
    _FILE_TOKEN = None


def current_token():
    """Bearer token. Prefers the production token file; falls back to the
    JARVIS_BRIDGE_TOKEN environment variable only when the file is absent
    (local testing). Never persisted to the job store."""
    if _FILE_TOKEN:
        return _FILE_TOKEN
    env = os.environ.get("JARVIS_BRIDGE_TOKEN", "").strip()
    return env or None


# Backwards-compatible module attribute for any external reference.
TOKEN = _FILE_TOKEN


def jobs_dir():
    return Path(os.environ.get("JARVIS_BRIDGE_JOBS_DIR", DEFAULT_JOBS_DIR))


def claude_timeout():
    try:
        return int(
            os.environ.get(
                "JARVIS_BRIDGE_CLAUDE_TIMEOUT",
                str(DEFAULT_CLAUDE_TIMEOUT),
            )
        )
    except (TypeError, ValueError):
        return DEFAULT_CLAUDE_TIMEOUT


def inside_root(path, root):
    try:
        Path(path).resolve().relative_to(Path(root).resolve())
        return True
    except ValueError:
        return False


def git_state(cwd):
    def run_git(*args):
        return subprocess.run(
            ["git", "-C", str(cwd), *args],
            capture_output=True,
            text=True,
            timeout=15
        )

    inside = run_git("rev-parse", "--is-inside-work-tree")
    if inside.returncode != 0 or inside.stdout.strip() != "true":
        return {
            "is_repo": False,
            "branch": None,
            "head": None,
            "clean": None,
            "status": [],
            "error": inside.stderr.strip()[:500] or "not a git repository"
        }

    head = run_git("rev-parse", "HEAD")

    branch = run_git("symbolic-ref", "--quiet", "--short", "HEAD")
    if branch.returncode != 0:
        branch = run_git("rev-parse", "--abbrev-ref", "HEAD")

    status_result = run_git(
        "status",
        "--porcelain=v1",
        "--untracked-files=all"
    )

    status_lines = [
        line for line in status_result.stdout.splitlines()
        if line.strip()
    ]

    return {
        "is_repo": True,
        "branch": branch.stdout.strip() if branch.returncode == 0 else None,
        "head": head.stdout.strip() if head.returncode == 0 else None,
        "clean": status_result.returncode == 0 and len(status_lines) == 0,
        "status": status_lines,
        "error": (
            None
            if status_result.returncode == 0
            else status_result.stderr.strip()[:500]
        )
    }


def git_change_evidence(cwd):
    def run_git(*args):
        return subprocess.run(
            ["git", "-C", str(cwd), *args],
            capture_output=True,
            text=True,
            timeout=30
        )

    names = run_git("diff", "--name-status", "HEAD", "--")
    untracked = run_git("ls-files", "--others", "--exclude-standard")
    ignored = run_git(
        "ls-files",
        "--others",
        "--ignored",
        "--exclude-standard"
    )
    diff_stat = run_git("diff", "--stat", "HEAD", "--")
    diff = run_git(
        "diff",
        "--no-ext-diff",
        "--unified=3",
        "HEAD",
        "--"
    )

    return {
        "tracked_name_status": [
            x for x in names.stdout.splitlines() if x.strip()
        ],
        "untracked_files": [
            x for x in untracked.stdout.splitlines() if x.strip()
        ],
        "ignored_files_present": [
            x for x in ignored.stdout.splitlines() if x.strip()
        ][:DELTA_PATH_LIMIT],
        "ignored_files_present_truncated": (
            len(ignored.stdout.splitlines()) > DELTA_PATH_LIMIT
        ),
        "diff_stat": diff_stat.stdout[-20000:],
        "diff": diff.stdout[-100000:],
        "error": (
            None
            if all(
                x.returncode == 0
                for x in [names, untracked, ignored, diff_stat, diff]
            )
            else "git change evidence incomplete"
        )
    }


def hash_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def workspace_snapshot(cwd):
    root = Path(cwd).resolve()
    entries = {}
    total_bytes = 0
    complete = True
    reasons = []

    def record(rel, payload):
        nonlocal complete
        if len(entries) >= SNAPSHOT_MAX_ENTRIES:
            complete = False
            if "ENTRY_LIMIT" not in reasons:
                reasons.append("ENTRY_LIMIT")
            return False
        entries[rel] = payload
        return True

    for dirpath, dirnames, filenames in os.walk(
        root,
        topdown=True,
        followlinks=False
    ):
        dirpath = Path(dirpath)

        # .git is intentionally excluded. Git state/diff is measured separately.
        filtered_dirs = []
        for name in sorted(dirnames):
            p = dirpath / name
            rel = p.relative_to(root).as_posix()

            if rel == ".git" or rel.startswith(".git/"):
                continue

            try:
                st = p.lstat()
            except OSError:
                complete = False
                reasons.append(f"LSTAT_FAILED:{rel}")
                continue

            if stat.S_ISLNK(st.st_mode):
                if not record(rel, {
                    "type": "symlink",
                    "target": os.readlink(p),
                    "mode": oct(stat.S_IMODE(st.st_mode))
                }):
                    break
            else:
                if not record(rel, {
                    "type": "dir",
                    "mode": oct(stat.S_IMODE(st.st_mode))
                }):
                    break
                filtered_dirs.append(name)

        dirnames[:] = filtered_dirs

        if len(entries) >= SNAPSHOT_MAX_ENTRIES:
            break

        for name in sorted(filenames):
            p = dirpath / name
            rel = p.relative_to(root).as_posix()

            if rel == ".git" or rel.startswith(".git/"):
                continue

            try:
                st = p.lstat()
            except OSError:
                complete = False
                reasons.append(f"LSTAT_FAILED:{rel}")
                continue

            mode = oct(stat.S_IMODE(st.st_mode))

            if stat.S_ISLNK(st.st_mode):
                payload = {
                    "type": "symlink",
                    "target": os.readlink(p),
                    "mode": mode
                }

            elif stat.S_ISREG(st.st_mode):
                if total_bytes + st.st_size > SNAPSHOT_MAX_BYTES:
                    complete = False
                    if "BYTE_LIMIT" not in reasons:
                        reasons.append("BYTE_LIMIT")
                    payload = {
                        "type": "file",
                        "size": st.st_size,
                        "sha256": None,
                        "mode": mode
                    }
                else:
                    try:
                        digest = hash_file(p)
                        total_bytes += st.st_size
                        payload = {
                            "type": "file",
                            "size": st.st_size,
                            "sha256": digest,
                            "mode": mode
                        }
                    except OSError:
                        complete = False
                        reasons.append(f"HASH_FAILED:{rel}")
                        payload = {
                            "type": "file",
                            "size": st.st_size,
                            "sha256": None,
                            "mode": mode
                        }
            else:
                payload = {
                    "type": "special",
                    "mode": mode
                }

            if not record(rel, payload):
                break

        if len(entries) >= SNAPSHOT_MAX_ENTRIES:
            break

    serialized = json.dumps(
        entries,
        sort_keys=True,
        separators=(",", ":")
    ).encode()

    return {
        "entries": entries,
        "summary": {
            "complete": complete,
            "reasons": sorted(set(reasons)),
            "entry_count": len(entries),
            "bytes_hashed": total_bytes,
            "sha256": hashlib.sha256(serialized).hexdigest(),
            "scope": "working-tree including hidden + ignored files; .git excluded"
        }
    }


def snapshot_delta(pre, post):
    a = pre["entries"]
    b = post["entries"]

    added_all = sorted(set(b) - set(a))
    removed_all = sorted(set(a) - set(b))
    changed_all = sorted(
        p for p in (set(a) & set(b))
        if a[p] != b[p]
    )

    truncated = any(
        len(x) > DELTA_PATH_LIMIT
        for x in [added_all, removed_all, changed_all]
    )

    return {
        "complete": (
            pre["summary"]["complete"]
            and post["summary"]["complete"]
            and not truncated
        ),
        "pre": pre["summary"],
        "post": post["summary"],
        "unchanged": (
            pre["summary"]["sha256"] == post["summary"]["sha256"]
        ),
        "added": added_all[:DELTA_PATH_LIMIT],
        "removed": removed_all[:DELTA_PATH_LIMIT],
        "changed": changed_all[:DELTA_PATH_LIMIT],
        "added_count": len(added_all),
        "removed_count": len(removed_all),
        "changed_count": len(changed_all),
        "paths_truncated": truncated
    }


def extract_target(input_obj, cwd):
    if not isinstance(input_obj, dict):
        return None

    raw = None
    for key in ("file_path", "path"):
        value = input_obj.get(key)
        if isinstance(value, str) and value.strip():
            raw = value.strip()
            break

    if raw is None:
        return None

    p = Path(raw)
    if not p.is_absolute():
        p = Path(cwd) / p

    resolved = p.resolve()

    return {
        "requested": raw,
        "resolved": str(resolved),
        "inside_workspace": inside_root(resolved, cwd)
    }


def sensitive_target(target):
    if not target:
        return False

    p = Path(target["resolved"])
    lower_parts = [x.lower() for x in p.parts]
    name = p.name.lower()

    sensitive_names = {
        ".env",
        ".env.local",
        ".env.production",
        ".env.development",
        "credentials.json",
        "service-account.json",
        "bridge_token",
        "id_rsa",
        "id_ed25519",
        ".npmrc",
        ".pypirc"
    }

    sensitive_dirs = {
        "secrets",
        ".ssh",
        ".aws"
    }

    return (
        name in sensitive_names
        or any(part in sensitive_dirs for part in lower_parts)
    )


def parse_claude_stream(stdout, cwd, allowed_tools):
    init = None
    result_event = None
    tool_uses = []
    hook_events = []
    parse_errors = []
    event_types = Counter()

    for line_number, line in enumerate(stdout.splitlines(), start=1):
        if not line.strip():
            continue

        try:
            event = json.loads(line)
        except Exception:
            parse_errors.append(line_number)
            continue

        event_type = str(event.get("type", "unknown"))
        event_types[event_type] += 1

        subtype = str(event.get("subtype", ""))

        if event_type == "system" and subtype == "init":
            init = event

        if "hook" in event_type.lower() or "hook" in subtype.lower():
            hook_events.append({
                "type": event_type,
                "subtype": subtype
            })

        if event_type == "assistant":
            content = (
                event.get("message", {})
                .get("content", [])
            )

            if isinstance(content, list):
                for block in content:
                    if (
                        isinstance(block, dict)
                        and block.get("type") == "tool_use"
                    ):
                        name = str(block.get("name", ""))
                        target = extract_target(
                            block.get("input", {}),
                            cwd
                        )

                        tool_uses.append({
                            "id": block.get("id"),
                            "name": name,
                            "target": target,
                            "sensitive_target": sensitive_target(target)
                        })

        if event_type == "result":
            result_event = event

    declared_tools = (
        init.get("tools", [])
        if isinstance(init, dict)
        else []
    )
    mcp_servers = (
        init.get("mcp_servers", [])
        if isinstance(init, dict)
        else []
    )
    slash_commands = (
        init.get("slash_commands", [])
        if isinstance(init, dict)
        else []
    )
    plugins = (
        init.get("plugins", [])
        if isinstance(init, dict)
        else []
    )
    skills = (
        init.get("skills", [])
        if isinstance(init, dict)
        else []
    )

    forbidden_tool_uses = [
        x for x in tool_uses
        if x["name"] not in allowed_tools
    ]

    outside_workspace_targets = [
        x for x in tool_uses
        if x["target"]
        and not x["target"]["inside_workspace"]
    ]

    sensitive_targets = [
        x for x in tool_uses
        if x["sensitive_target"]
    ]

    permission_denials = (
        result_event.get("permission_denials", [])
        if isinstance(result_event, dict)
        else []
    )

    audit_complete = (
        init is not None
        and result_event is not None
        and len(parse_errors) == 0
    )

    declared_exact = (
        set(declared_tools) == set(allowed_tools)
    )

    compliant = all([
        audit_complete,
        declared_exact,
        len(forbidden_tool_uses) == 0,
        len(outside_workspace_targets) == 0,
        len(sensitive_targets) == 0,
        len(permission_denials) == 0,
        len(mcp_servers) == 0,
        len(slash_commands) == 0,
        len(plugins) == 0,
        len(skills) == 0,
        len(hook_events) == 0
    ])

    return {
        "complete": audit_complete,
        "compliant": compliant,
        "declared_tools": declared_tools,
        "expected_tools": allowed_tools,
        "declared_tools_exact": declared_exact,
        "tool_uses": tool_uses,
        "tool_use_count": len(tool_uses),
        "forbidden_tool_uses": forbidden_tool_uses,
        "outside_workspace_targets": outside_workspace_targets,
        "sensitive_targets": sensitive_targets,
        "permission_denials": permission_denials,
        "mcp_servers": mcp_servers,
        "slash_commands": slash_commands,
        "plugins": plugins,
        "skills": skills,
        "hook_events": hook_events,
        "stream_parse_error_lines": parse_errors,
        "event_types": dict(event_types),
        "session_id": (
            result_event.get("session_id")
            if isinstance(result_event, dict)
            else None
        ),
        "subtype": (
            result_event.get("subtype")
            if isinstance(result_event, dict)
            else None
        ),
        "terminal_reason": (
            result_event.get("terminal_reason")
            if isinstance(result_event, dict)
            else None
        ),
        "is_error": (
            result_event.get("is_error")
            if isinstance(result_event, dict)
            else None
        ),
        "result": (
            result_event.get("result")
            if isinstance(result_event, dict)
            else None
        )
    }


def response(handler, status_code, payload):
    body = json.dumps(payload).encode()
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


IMPLEMENT_PREAMBLE = (
    "STRICT JARVIS IMPLEMENTATION MODE.\n"
    "Use only the tools made available by this session.\n"
    "Do not request or attempt Bash, shell, git, network, "
    "package-manager, MCP, subagent, skill, deployment, "
    "secret, billing, DNS, PR, merge, commit or push actions.\n"
    "Do not access credential or secret files.\n"
    "The JARVIS bridge independently performs PRE/POST Git, "
    "filesystem and tool-audit verification.\n"
    "Only make the bounded workspace changes explicitly "
    "authorized below.\n\n"
)


def build_spec(data):
    """Validate a logical bridge request and derive the execution spec.

    Preserves every V4 security check: prompt presence/size, project
    confinement under ROOT, project existence, mode validation, per-mode
    bounded tool allowlists, the strict implement preamble and the hardened
    Claude CLI flags. Raises ValueError on any invalid input.

    Returns an in-process dict (never serialised verbatim to disk).
    """
    if not isinstance(data, dict):
        raise ValueError("invalid request body")

    prompt = str(data.get("prompt", "")).strip()
    project = str(data.get("project", "")).strip()
    mode = str(data.get("mode", "review")).strip()

    if not prompt or len(prompt) > MAX_PROMPT_CHARS:
        raise ValueError("invalid prompt")

    cwd = ROOT
    if project:
        candidate = (ROOT / project).resolve()
        if ROOT not in candidate.parents and candidate != ROOT:
            raise ValueError("invalid project path")
        if not candidate.is_dir():
            raise ValueError("project does not exist")
        cwd = candidate

    if mode not in {"review", "implement"}:
        raise ValueError("invalid mode")

    if mode == "review":
        allowed_tools = ["Read", "Glob", "Grep"]
    else:
        allowed_tools = ["Read", "Glob", "Grep", "Edit", "Write"]

    effective_prompt = prompt
    if mode == "implement":
        effective_prompt = IMPLEMENT_PREAMBLE + prompt

    permission_mode = "dontAsk" if mode == "review" else "acceptEdits"

    cmd = [
        "claude",
        "-p",
        effective_prompt,
        "--output-format",
        "stream-json",
        "--verbose",
        "--include-hook-events",
        "--permission-prompts",
        "none",
        "--permission-mode",
        permission_mode,
        "--no-session-persistence",
        "--restricted",
        "--strict-mcp-config",
        "--disable-slash-commands",
        "--tools",
        ",".join(allowed_tools),
    ]

    return {
        "prompt": prompt,
        "project": project,
        "mode": mode,
        "cwd": cwd,
        "allowed_tools": allowed_tools,
        "permission_mode": permission_mode,
        "cmd": cmd,
    }


# ---------------------------------------------------------------------------
# Persistent job store: atomic IO
# ---------------------------------------------------------------------------

def _atomic_write(path: Path, data: bytes):
    """Write bytes to ``path`` atomically: write a sibling temp file, fsync it,
    then os.replace() over the target. A reader therefore never observes a
    partially written file."""
    d = path.parent
    fd, tmp = tempfile.mkstemp(dir=str(d), prefix=".tmp-", suffix=path.name)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    try:
        dfd = os.open(str(d), os.O_DIRECTORY)
        try:
            os.fsync(dfd)
        finally:
            os.close(dfd)
    except OSError:
        pass


def atomic_write_json(path: Path, obj):
    _atomic_write(
        Path(path),
        json.dumps(obj, indent=2, sort_keys=True, default=str).encode(),
    )


def read_json(path: Path):
    with open(path, "rb") as f:
        return json.loads(f.read().decode())


# ---------------------------------------------------------------------------
# Persistent job store: identity & confinement
# ---------------------------------------------------------------------------

def create_job_id():
    """Cryptographically secure, filesystem-safe job id (128 bits)."""
    return secrets.token_hex(16)


def valid_job_id(value):
    """True only for exactly 32 lowercase hex chars. Rejects '', '..', '/',
    absolute paths, NUL, and every other traversal vector before any
    filesystem use."""
    return isinstance(value, str) and _JOB_ID_RE.match(value) is not None


def job_paths(job_id):
    if not valid_job_id(job_id):
        raise ValueError("INVALID_JOB_ID")
    root = jobs_dir()
    d = root / job_id
    # Belt-and-braces: the resolved directory must sit directly under the
    # (resolved) job root. The regex already guarantees this.
    if d.resolve().parent != root.resolve():
        raise ValueError("INVALID_JOB_ID")
    return {
        "dir": d,
        "state": d / "state.json",
        "result": d / "result.json",
        "stdout": d / "claude_stdout.jsonl",
        "stderr": d / "claude_stderr.txt",
    }


def ensure_jobs_dir():
    try:
        jobs_dir().mkdir(parents=True, exist_ok=True)
    except OSError:
        # Surfaced later on first write; do not crash the server here.
        pass


# ---------------------------------------------------------------------------
# Persistent job store: state
# ---------------------------------------------------------------------------

def _new_state(job_id, spec):
    now = time.time()
    return {
        "job_id": job_id,
        "bridge_version": BRIDGE_VERSION,
        "status": QUEUED,
        "created_at": now,
        "started_at": None,
        "finished_at": None,
        "project": spec["project"] or None,
        "mode": spec["mode"],
        # The prompt itself is deliberately NOT persisted (it may carry
        # sensitive content). Only a length and a digest are kept, which are
        # enough to correlate a job with the originating request.
        "prompt_chars": len(spec["prompt"]),
        "prompt_sha256": hashlib.sha256(spec["prompt"].encode()).hexdigest(),
        "allowed_tools": spec["allowed_tools"],
        "claude_exit_code": None,
        "timed_out": False,
        "failure": None,
        "recovery": None,
        "evidence": {},
        "result_available": False,
    }


def update_state(job_id, changes):
    """Atomic read-modify-write of a single job's state.json."""
    sp = job_paths(job_id)["state"]
    with STATE_LOCK:
        st = read_json(sp)
        st.update(changes)
        atomic_write_json(sp, st)
    return st


def count_active_jobs():
    root = jobs_dir()
    if not root.is_dir():
        return 0
    n = 0
    for child in root.iterdir():
        if not (child.is_dir() and valid_job_id(child.name)):
            continue
        try:
            st = read_json(child / "state.json")
        except (OSError, ValueError):
            continue
        if st.get("status") in (QUEUED, RUNNING):
            n += 1
    return n


class ActiveJobLimit(Exception):
    pass


def create_job(spec):
    """Persist a new QUEUED job in its own confined directory. Does not run it."""
    ensure_jobs_dir()
    if count_active_jobs() >= MAX_ACTIVE_JOBS:
        raise ActiveJobLimit()
    job_id = create_job_id()
    paths = job_paths(job_id)
    paths["dir"].mkdir(parents=True, exist_ok=False)
    atomic_write_json(paths["state"], _new_state(job_id, spec))
    return job_id


def submit_job(spec):
    """Persist a job and hand it to the background worker. Returns immediately."""
    job_id = create_job(spec)
    start_worker()
    WORK_Q.put((job_id, spec))
    return job_id


# ---------------------------------------------------------------------------
# Claude execution + evidence collection (independent of any HTTP connection)
# ---------------------------------------------------------------------------

def _safe(fn, *args):
    try:
        return fn(*args), None
    except Exception as e:  # noqa: BLE001 - evidence collection must not abort
        return None, f"{type(e).__name__}: {e}"[:300]


def _as_text(value):
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    return str(value)


def _finalize(job_id, spec, *, pre_git, pre_snapshot, rc, timed_out,
              failure, stdout, stderr, ran_claude):
    """Collect POST evidence, compute the bridge verdict, and persist the
    result + final state atomically. Always runs, whatever happened to Claude."""
    paths = job_paths(job_id)
    cwd = spec["cwd"]
    allowed_tools = spec["allowed_tools"]

    _atomic_write(paths["stdout"], (stdout or "").encode())
    _atomic_write(paths["stderr"], (stderr or "").encode())

    post_git, _ = _safe(git_state, cwd)
    post_snapshot, _ = _safe(workspace_snapshot, cwd)
    changes, changes_exc = _safe(git_change_evidence, cwd)

    if pre_snapshot and post_snapshot:
        fs_delta, delta_exc = _safe(snapshot_delta, pre_snapshot, post_snapshot)
        if fs_delta is None:
            fs_delta = {"complete": False, "error": delta_exc}
    else:
        fs_delta = {"complete": False, "error": "snapshot unavailable"}

    audit = parse_claude_stream(stdout or "", cwd, allowed_tools)

    changes_error = changes_exc or (changes or {}).get("error")

    bridge_ok = (
        ran_claude
        and not timed_out
        and failure is None
        and rc == 0
        and audit["complete"]
        and audit["compliant"]
        and fs_delta.get("complete") is True
        and changes_error is None
    )

    if bridge_ok:
        final_status = COMPLETE
    else:
        final_status = FAILED
        if failure is None:
            failure = {
                "reason": "BRIDGE_VERIFICATION_FAILED",
                "phase": "post_verify",
                "exit_code": rc,
                "audit_complete": audit["complete"],
                "audit_compliant": audit["compliant"],
                "fs_delta_complete": fs_delta.get("complete"),
                "changes_error": changes_error,
            }

    head_unchanged = (pre_git or {}).get("head") == (post_git or {}).get("head")

    result = {
        "ok": bridge_ok,
        "job_id": job_id,
        "status": final_status,
        "mode": spec["mode"],
        "project": spec["project"] or None,
        "exit_code": rc,
        "timed_out": timed_out,
        "ran_claude": ran_claude,
        "failure": failure,
        "git_evidence": {
            "pre": pre_git,
            "post": post_git,
            "head_unchanged": head_unchanged,
            "changes": changes,
        },
        "filesystem_evidence": fs_delta,
        "tool_audit": audit,
        "stderr": (stderr or "")[-20000:],
    }
    atomic_write_json(paths["result"], result)

    update_state(job_id, {
        "status": final_status,
        "finished_at": time.time(),
        "claude_exit_code": rc,
        "timed_out": timed_out,
        "failure": failure,
        "result_available": True,
        "evidence": {
            "pre_git": pre_git,
            "pre_fs_summary": (pre_snapshot or {}).get("summary"),
            "post_git": post_git,
            "post_fs_summary": (post_snapshot or {}).get("summary"),
            "fs_delta": fs_delta,
            "changes": changes,
            "tool_audit": audit,
            "head_unchanged": head_unchanged,
        },
    })
    return final_status


def execute_job(job_id, spec):
    """Run one job to a durable terminal state. Never raises for an expected
    Claude outcome (success / non-zero / timeout / internal exception)."""
    cwd = spec["cwd"]
    mode = spec["mode"]

    with LOCK:
        update_state(job_id, {"status": RUNNING, "started_at": time.time()})

        pre_git, pre_git_exc = _safe(git_state, cwd)
        pre_snapshot, pre_snap_exc = _safe(workspace_snapshot, cwd)
        pre_fs_summary = (
            pre_snapshot["summary"] if pre_snapshot
            else {"complete": False, "error": pre_snap_exc}
        )
        update_state(job_id, {"evidence": {
            "pre_git": pre_git,
            "pre_fs_summary": pre_fs_summary,
        }})

        # Implement-mode gating - identical checks to V4 /v1/run, enforced
        # under LOCK so they cannot race, but here they produce a durable
        # FAILED job with evidence instead of a transient HTTP 409.
        if mode == "implement":
            gate = None
            if not (pre_git or {}).get("is_repo"):
                gate = "IMPLEMENT_REQUIRES_GIT_REPOSITORY"
            elif (pre_git or {}).get("clean") is not True:
                gate = "IMPLEMENT_REQUIRES_CLEAN_WORKSPACE"
            elif not (pre_fs_summary or {}).get("complete"):
                gate = "PRE_SNAPSHOT_INCOMPLETE"
            if gate:
                return _finalize(
                    job_id, spec,
                    pre_git=pre_git, pre_snapshot=pre_snapshot,
                    rc=None, timed_out=False,
                    failure={"reason": gate, "phase": "pre_gate"},
                    stdout="", stderr="", ran_claude=False,
                )

        rc = None
        timed_out = False
        exc = None
        stdout = ""
        stderr = ""
        try:
            proc = subprocess.run(
                spec["cmd"],
                cwd=str(cwd),
                capture_output=True,
                text=True,
                timeout=claude_timeout(),
            )
            rc = proc.returncode
            stdout = proc.stdout or ""
            stderr = proc.stderr or ""
        except subprocess.TimeoutExpired as te:
            timed_out = True
            stdout = _as_text(te.stdout)
            stderr = _as_text(te.stderr)
        except Exception as ex:  # noqa: BLE001
            exc = f"{type(ex).__name__}: {ex}"[:500]

        if timed_out:
            failure = {
                "reason": "CLAUDE_TIMEOUT",
                "phase": "claude_exec",
                "timeout_seconds": claude_timeout(),
            }
        elif exc is not None:
            failure = {
                "reason": "CLAUDE_EXECUTION_EXCEPTION",
                "phase": "claude_exec",
                "exception": exc,
            }
        elif rc != 0:
            failure = {
                "reason": "CLAUDE_NONZERO_EXIT",
                "phase": "claude_exec",
                "exit_code": rc,
            }
        else:
            failure = None

        return _finalize(
            job_id, spec,
            pre_git=pre_git, pre_snapshot=pre_snapshot,
            rc=rc, timed_out=timed_out, failure=failure,
            stdout=stdout, stderr=stderr, ran_claude=True,
        )


# ---------------------------------------------------------------------------
# Background worker (single thread -> serialised execution)
# ---------------------------------------------------------------------------

def _worker_loop():
    while True:
        job_id, spec = WORK_Q.get()
        try:
            execute_job(job_id, spec)
        except Exception:  # noqa: BLE001 - last-resort durability net
            try:
                paths = job_paths(job_id)
                update_state(job_id, {
                    "status": FAILED,
                    "finished_at": time.time(),
                    "failure": {
                        "reason": "WORKER_EXCEPTION",
                        "phase": "worker",
                        "traceback": traceback.format_exc()[-4000:],
                    },
                    "result_available": paths["result"].exists(),
                })
            except Exception:
                pass
        finally:
            WORK_Q.task_done()


def start_worker():
    global _worker_started
    with _worker_lock:
        if _worker_started:
            return
        threading.Thread(
            target=_worker_loop,
            name="jarvis-job-worker",
            daemon=True,
        ).start()
        _worker_started = True


# ---------------------------------------------------------------------------
# Fail-closed recovery of orphaned jobs after a bridge restart
# ---------------------------------------------------------------------------

def recover_orphaned_jobs():
    """Any job left QUEUED/RUNNING by a previous process is deterministically
    moved to FAILED with an explicit reason. Orphaned implementation jobs are
    never re-run, and their result is always failed closed - even a stale
    ``ok``/``COMPLETE`` result.json from an interrupted finalize is overwritten
    with an explicitly-failed result."""
    root = jobs_dir()
    if not root.is_dir():
        return []

    recovered = []
    for child in sorted(root.iterdir()):
        if not (child.is_dir() and valid_job_id(child.name)):
            continue
        sp = child / "state.json"
        try:
            st = read_json(sp)
        except (OSError, ValueError):
            continue
        if st.get("status") not in (QUEUED, RUNNING):
            continue

        failure = {
            "reason": ORPHAN_REASON,
            "phase": "recovery",
            "previous_status": st.get("status"),
            "detail": (
                "Job was non-terminal at bridge startup: a prior bridge "
                "process exited without finalizing it. Fail-closed - marked "
                "FAILED and not re-run."
            ),
        }
        # Fail closed: a result.json written by the previous process is
        # unverified, because that process exited before flipping state.json to
        # a terminal status. It may even be a partially/fully written success
        # from an interrupted _finalize(). Never let a stale ok/COMPLETE result
        # stand - always overwrite with an explicitly-failed result, retaining
        # any prior content only as inert forensic material.
        rp = child / "result.json"
        prior_result = None
        if rp.exists():
            try:
                prior_result = read_json(rp)
            except (OSError, ValueError) as e:
                prior_result = {"_unreadable": f"{type(e).__name__}: {e}"[:200]}
        atomic_write_json(rp, {
            "ok": False,
            "job_id": child.name,
            "status": FAILED,
            "mode": st.get("mode"),
            "project": st.get("project"),
            "failure": failure,
            "note": (
                "Bridge restarted before this job was finalized. Any result "
                "written by the previous process is unverified and is not "
                "trusted; the job is failed closed."
            ),
            "unverified_prior_result": prior_result,
        })
        st.update({
            "status": FAILED,
            "finished_at": time.time(),
            "timed_out": bool(st.get("timed_out", False)),
            "failure": failure,
            "recovery": failure,
            "result_available": True,
        })
        atomic_write_json(sp, st)
        recovered.append(child.name)
    return recovered


# ---------------------------------------------------------------------------
# HTTP layer
# ---------------------------------------------------------------------------

_JOB_GET_RE = re.compile(r"\A/v1/jobs/([^/]+)(/result)?\Z")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _authed(self):
        tok = current_token()
        if not tok:
            return False
        got = self.headers.get("Authorization", "")
        try:
            return hmac.compare_digest(got, f"Bearer {tok}")
        except TypeError:
            return False

    def _read_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BODY_BYTES:
            raise ValueError("invalid body size")
        return json.loads(self.rfile.read(length))

    # -- GET ---------------------------------------------------------------

    def do_GET(self):
        path = self.path.split("?", 1)[0]

        if path == "/health":
            return response(self, 200, {
                "ok": True,
                "service": "jarvis-claude-bridge",
                "version": BRIDGE_VERSION,
            })

        m = _JOB_GET_RE.match(path)
        if m:
            return self._job_get(m.group(1), m.group(2) == "/result")

        return response(self, 404, {"ok": False})

    def _job_get(self, job_id, want_result):
        if not self._authed():
            return response(self, 401, {"ok": False, "error": "UNAUTHORIZED"})

        if not valid_job_id(job_id):
            return response(self, 400, {"ok": False, "error": "INVALID_JOB_ID"})

        paths = job_paths(job_id)
        if not paths["dir"].is_dir() or not paths["state"].exists():
            return response(self, 404, {"ok": False, "error": "JOB_NOT_FOUND"})

        try:
            st = read_json(paths["state"])
        except (OSError, ValueError):
            return response(self, 503, {
                "ok": False, "error": "STATE_UNREADABLE",
            })

        if not want_result:
            return response(self, 200, {"ok": True, **st})

        # /result: only ever return the final persisted bridge result.
        if st.get("status") not in TERMINAL_STATUSES:
            return response(self, 409, {
                "ok": False,
                "status": st.get("status"),
                "error": "RESULT_NOT_READY",
            })
        if not paths["result"].exists():
            return response(self, 409, {
                "ok": False,
                "status": st.get("status"),
                "error": "RESULT_UNAVAILABLE",
                "failure": st.get("failure"),
            })
        try:
            return response(self, 200, read_json(paths["result"]))
        except (OSError, ValueError):
            return response(self, 503, {
                "ok": False, "error": "RESULT_UNREADABLE",
            })

    # -- POST ------------------------------------------------------------

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/v1/run":
            return self._handle_run()
        if path == "/v1/jobs":
            return self._handle_jobs_submit()
        return response(self, 404, {"ok": False})

    def _handle_jobs_submit(self):
        if not self._authed():
            return response(self, 401, {"ok": False, "error": "UNAUTHORIZED"})

        try:
            data = self._read_body()
            spec = build_spec(data)
        except Exception as e:  # ValueError / JSONDecodeError -> bad request
            return response(self, 400, {"ok": False, "error": str(e)[:500]})

        try:
            job_id = submit_job(spec)
        except ActiveJobLimit:
            return response(self, 429, {
                "ok": False, "error": "TOO_MANY_ACTIVE_JOBS",
            })
        except Exception as e:  # noqa: BLE001
            return response(self, 500, {"ok": False, "error": str(e)[:500]})

        # Return immediately; Claude runs on the worker, not this connection.
        return response(self, 202, {
            "ok": True,
            "job_id": job_id,
            "status": QUEUED,
        })

    def _handle_run(self):
        """Preserved V4 synchronous endpoint. Behaviour unchanged."""
        if not self._authed():
            return response(self, 401, {"ok": False, "error": "UNAUTHORIZED"})

        try:
            data = self._read_body()
            spec = build_spec(data)

            cwd = spec["cwd"]
            mode = spec["mode"]
            project = spec["project"]
            allowed_tools = spec["allowed_tools"]

            with LOCK:
                pre_git = git_state(cwd)
                pre_snapshot = workspace_snapshot(cwd)

                if mode == "implement":
                    if not pre_git.get("is_repo"):
                        return response(self, 409, {
                            "ok": False,
                            "error": "IMPLEMENT_REQUIRES_GIT_REPOSITORY",
                            "git_evidence": {"pre": pre_git},
                        })
                    if pre_git.get("clean") is not True:
                        return response(self, 409, {
                            "ok": False,
                            "error": "IMPLEMENT_REQUIRES_CLEAN_WORKSPACE",
                            "git_evidence": {"pre": pre_git},
                        })
                    if not pre_snapshot["summary"]["complete"]:
                        return response(self, 409, {
                            "ok": False,
                            "error": "PRE_SNAPSHOT_INCOMPLETE",
                            "filesystem_evidence": {
                                "pre": pre_snapshot["summary"],
                            },
                        })

                proc = subprocess.run(
                    spec["cmd"],
                    cwd=str(cwd),
                    capture_output=True,
                    text=True,
                    timeout=DEFAULT_CLAUDE_TIMEOUT,
                )

                post_git = git_state(cwd)
                post_snapshot = workspace_snapshot(cwd)
                changes = git_change_evidence(cwd)
                fs_delta = snapshot_delta(pre_snapshot, post_snapshot)
                audit = parse_claude_stream(proc.stdout, cwd, allowed_tools)

            bridge_ok = (
                proc.returncode == 0
                and audit["complete"]
                and audit["compliant"]
                and fs_delta["complete"]
                and changes["error"] is None
            )

            return response(self, 200, {
                "ok": bridge_ok,
                "mode": mode,
                "project": project or None,
                "exit_code": proc.returncode,
                "git_evidence": {
                    "pre": pre_git,
                    "post": post_git,
                    "head_unchanged": (
                        pre_git.get("head") == post_git.get("head")
                    ),
                    "changes": changes,
                },
                "filesystem_evidence": fs_delta,
                "tool_audit": audit,
                "stderr": proc.stderr[-20000:],
            })

        except subprocess.TimeoutExpired:
            return response(self, 504, {
                "ok": False,
                "error": "CLAUDE_TIMEOUT",
            })

        except Exception as e:
            return response(self, 400, {
                "ok": False,
                "error": str(e)[:500],
            })


def serve():
    ensure_jobs_dir()
    recovered = recover_orphaned_jobs()
    if recovered:
        print(
            f"[bridge-v{BRIDGE_VERSION}] fail-closed recovery of "
            f"{len(recovered)} orphaned job(s): {recovered}"
        )
    start_worker()
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    serve()

import hashlib
import json
import os
import re
import signal
import stat
import subprocess
import threading
import time
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "0.0.0.0"
PORT = 8788
ROOT = Path("/workspace/projects").resolve()
TOKEN_FILE = Path("/home/claude/.claude/bridge_token")
LOCK = threading.Lock()

CLAUDE_TERM_GRACE_SECONDS = 3
CLAUDE_REAP_GRACE_SECONDS = 3

UUID_RE = re.compile(r"\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\Z", re.I)

SNAPSHOT_MAX_ENTRIES = 100000
SNAPSHOT_MAX_BYTES = 512 * 1024 * 1024
DELTA_PATH_LIMIT = 1000

TOKEN = TOKEN_FILE.read_text().strip()

ENHANCEMENT_ROOT = Path("/home/claude/.claude/jarvis-enhancement-v1")
ENHANCEMENT_PROMPT_FILE = ENHANCEMENT_ROOT / "system-prompt.txt"
ENHANCEMENT_AGENTS_FILE = ENHANCEMENT_ROOT / "agents.json"
ENHANCEMENT_PROMPT = ENHANCEMENT_PROMPT_FILE.read_text().strip()
ENHANCEMENT_AGENTS_JSON = ENHANCEMENT_AGENTS_FILE.read_text().strip()
ENHANCEMENT_AGENTS = json.loads(ENHANCEMENT_AGENTS_JSON)
if not isinstance(ENHANCEMENT_AGENTS, dict) or not ENHANCEMENT_AGENTS:
    raise RuntimeError("JARVIS enhancement agents invalid")
ALLOWED_SPECIALISTS = frozenset(str(x) for x in ENHANCEMENT_AGENTS.keys())
MAX_SPECIALIST_INVOCATIONS = 2


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


def safe_repair_dirty_status(git_state_obj):
    """Allow only ordinary unstaged modifications and untracked files.
    Staged changes, deletes, renames, copies, conflicts and unreadable status
    remain fail-closed. The outer JARVIS wave evidence gate still enforces
    the exact wave allowlist.
    """
    if not isinstance(git_state_obj, dict) or git_state_obj.get("error"):
        return False
    rows = git_state_obj.get("status") or []
    if not rows:
        return False
    return all(row.startswith(" M ") or row.startswith("?? ") for row in rows)


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
    result_events = []
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

        if event_type == "system" and subtype == "init" and init is None:
            # The parent session init is first. Background custom agents can emit
            # another init later in the same stream; never let that replace the
            # authoritative parent declaration.
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
                        tool_input = block.get("input", {}) if isinstance(block.get("input", {}), dict) else {}
                        target = extract_target(tool_input, cwd)
                        specialist = None
                        if name == "Agent":
                            specialist = str(
                                tool_input.get("subagent_type")
                                or tool_input.get("agent")
                                or tool_input.get("name")
                                or ""
                            ).strip()

                        tool_uses.append({
                            "id": block.get("id"),
                            "name": name,
                            "target": target,
                            "specialist": specialist,
                            "sensitive_target": sensitive_target(target)
                        })

        if event_type == "result":
            result_events.append(event)
            # Claude Code emits the parent result first, then background-agent
            # result events. Keep the parent result for the public bridge result.
            if result_event is None:
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

    specialist_invocations = [x for x in tool_uses if x["name"] == "Agent"]
    unknown_specialists = [
        x for x in specialist_invocations
        if not x.get("specialist") or x.get("specialist") not in ALLOWED_SPECIALISTS
    ]
    specialist_fanout_ok = len(specialist_invocations) <= MAX_SPECIALIST_INVOCATIONS

    permission_denials = []
    result_errors = []
    for result in result_events:
        if not isinstance(result, dict):
            continue
        permission_denials.extend(result.get("permission_denials", []) or [])
        if result.get("is_error") is True or str(result.get("subtype", "")).lower() not in {"", "success"}:
            result_errors.append({
                "subtype": result.get("subtype"),
                "is_error": result.get("is_error"),
                "terminal_reason": result.get("terminal_reason")
            })

    audit_complete = (
        init is not None
        and result_event is not None
        and len(parse_errors) == 0
    )

    # Claude Code 2.1.266 exposes the custom-agent capability as `Task` in
    # the init tool inventory even though --tools and assistant tool_use events
    # use `Agent`. Canonicalize only for the declaration comparison.
    declared_canonical = [
        "Agent" if str(name) == "Task" else str(name)
        for name in declared_tools
    ]
    declared_exact = (
        set(declared_canonical) == set(allowed_tools)
    )

    compliant = all([
        audit_complete,
        declared_exact,
        len(forbidden_tool_uses) == 0,
        len(outside_workspace_targets) == 0,
        len(sensitive_targets) == 0,
        len(unknown_specialists) == 0,
        specialist_fanout_ok,
        len(permission_denials) == 0,
        len(result_errors) == 0,
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
        "specialist_invocations": specialist_invocations,
        "specialist_invocation_count": len(specialist_invocations),
        "unknown_specialists": unknown_specialists,
        "specialist_fanout_ok": specialist_fanout_ok,
        "permission_denials": permission_denials,
        "result_event_count": len(result_events),
        "result_errors": result_errors,
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


class ClaudeLifecycleError(RuntimeError):
    """Raised when establishing or tearing down the Claude process group itself
    fails. The V5 execution path treats this as a hard FAILED outcome and must
    never convert it into a COMPLETE / success result."""


class ClaudeRun:
    """Outcome of one bounded Claude execution. Shaped so the existing evidence
    code can treat it like the old ``subprocess.run`` return value
    (``stdout`` / ``stderr`` / ``returncode``)."""

    __slots__ = ("stdout", "stderr", "returncode", "timed_out",
                 "term_signalled", "killed", "pid")

    def __init__(self, *, stdout, stderr, returncode, timed_out,
                 term_signalled, killed, pid):
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode
        self.timed_out = timed_out
        self.term_signalled = term_signalled
        self.killed = killed
        self.pid = pid


def _signal_claude_group(pid, sig):
    """Deliver ``sig`` to the whole process group led by ``pid``.

    Returns True if the signal was delivered or the group is already gone;
    False on an unexpected error (e.g. EPERM), which the caller escalates to a
    fail-closed ClaudeLifecycleError."""
    try:
        os.killpg(pid, sig)
        return True
    except ProcessLookupError:
        return True
    except OSError:
        return False


def _live_claude_group_members(pgid):
    """Return live (non-zombie) PIDs still in ``pgid``.

    ``communicate()`` only proves the direct child was reaped and its stdio
    closed. A descendant can close inherited stdio, outlive that child, and
    continue mutating the workspace. Bridge runs on Linux; /proc lets us prove
    that the execution process group is quiescent before returning.
    """
    members = []
    try:
        entries = list(os.scandir("/proc"))
    except OSError as exc:
        raise ClaudeLifecycleError(
            f"could not inspect /proc for Claude process group {pgid}: {exc}"
        ) from exc

    for entry in entries:
        if not entry.name.isdigit():
            continue
        try:
            raw = Path(entry.path, "stat").read_text()
        except (FileNotFoundError, ProcessLookupError, PermissionError, OSError):
            # /proc is inherently racy. Claude descendants run as the same uid;
            # unrelated unreadable processes cannot belong to this new session.
            continue
        try:
            fields = raw.rsplit(")", 1)[1].split()
            state = fields[0]
            pgrp = int(fields[2])
        except (IndexError, ValueError):
            continue
        if pgrp == pgid and state != "Z":
            members.append(int(entry.name))
    return sorted(members)


def _wait_claude_group_quiescent(pgid, timeout):
    deadline = time.monotonic() + max(0.0, float(timeout))
    while True:
        if not _live_claude_group_members(pgid):
            return True
        if time.monotonic() >= deadline:
            return False
        time.sleep(0.05)


def _quiesce_surviving_claude_group(pgid, grace):
    """Ensure no live member of the execution group survives a completed child.

    Returns ``(term_signalled, killed)``. This covers the subtle case where the
    direct Claude process exits (even non-zero) after spawning a background
    descendant that closed stdout/stderr, so ``communicate()`` already returned.
    """
    if not _live_claude_group_members(pgid):
        return False, False

    if not _signal_claude_group(pgid, signal.SIGTERM):
        raise ClaudeLifecycleError(
            f"could not SIGTERM surviving Claude process group {pgid}"
        )
    if _wait_claude_group_quiescent(pgid, grace):
        return True, False

    if not _signal_claude_group(pgid, signal.SIGKILL):
        raise ClaudeLifecycleError(
            f"could not SIGKILL surviving Claude process group {pgid}"
        )
    if not _wait_claude_group_quiescent(pgid, CLAUDE_REAP_GRACE_SECONDS):
        survivors = _live_claude_group_members(pgid)
        raise ClaudeLifecycleError(
            "Claude process group still has live descendants after SIGKILL: "
            + ",".join(str(pid) for pid in survivors[:10])
        )
    return True, True


def _force_reap_direct(proc):
    """Last resort: make sure the DIRECT child is dead and reaped even when
    group-level teardown failed, so we never leak a zombie or block the worker.
    Returns whatever output could still be drained."""
    try:
        proc.kill()
    except OSError:
        pass
    try:
        out, err = proc.communicate(timeout=CLAUDE_REAP_GRACE_SECONDS)
    except (subprocess.TimeoutExpired, ValueError):
        try:
            proc.wait(timeout=CLAUDE_REAP_GRACE_SECONDS)
        except (subprocess.TimeoutExpired, ClaudeLifecycleError):
            pass
        out, err = "", ""
    return out or "", err or ""


def run_claude_bounded(cmd, cwd, timeout, grace=CLAUDE_TERM_GRACE_SECONDS, env=None):
    """Run ``cmd`` (a Claude CLI invocation) bounded by ``timeout`` seconds with
    an explicit POSIX process-group lifecycle. See the section comment above for
    the full contract. Returns a ``ClaudeRun``; raises ``ClaudeLifecycleError``
    only if lifecycle cleanup itself fails."""
    proc = subprocess.Popen(
        list(cmd),
        cwd=str(cwd),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
        env=env,
    )

    timed_out = False
    term_signalled = False
    killed = False

    try:
        try:
            stdout, stderr = proc.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True

            # 1. Graceful: SIGTERM the ENTIRE Claude process group.
            if not _signal_claude_group(proc.pid, signal.SIGTERM):
                _force_reap_direct(proc)
                raise ClaudeLifecycleError(
                    f"could not SIGTERM Claude process group {proc.pid}"
                )
            term_signalled = True

            try:
                stdout, stderr = proc.communicate(timeout=grace)
            except subprocess.TimeoutExpired:
                # 2. Force: SIGKILL the ENTIRE Claude process group.
                killed = True
                if not _signal_claude_group(proc.pid, signal.SIGKILL):
                    _force_reap_direct(proc)
                    raise ClaudeLifecycleError(
                        f"could not SIGKILL Claude process group {proc.pid}"
                    )
                try:
                    stdout, stderr = proc.communicate(
                        timeout=CLAUDE_REAP_GRACE_SECONDS
                    )
                except subprocess.TimeoutExpired:
                    # The group was SIGKILLed but output pipes are still open:
                    # a descendant escaped the group (called setsid() itself)
                    # or is wedged in uninterruptible I/O. Reap the direct
                    # child, which SIGKILL has definitely killed, and fail
                    # closed.
                    _force_reap_direct(proc)
                    raise ClaudeLifecycleError(
                        "Claude process group survived SIGKILL / left output "
                        "pipes open"
                    )

        # communicate() returning means the direct child was already waited
        # on; assert that explicitly so a reap failure can never masquerade as
        # success.
        if proc.returncode is None:
            try:
                proc.wait(timeout=CLAUDE_REAP_GRACE_SECONDS)
            except subprocess.TimeoutExpired:
                raise ClaudeLifecycleError(
                    f"Claude direct child {proc.pid} could not be reaped"
                )

        # Critical invariant: the direct child being gone is NOT enough. A
        # descendant may have closed inherited stdio and kept running. Before
        # this call returns, prove the execution process group is quiescent; if
        # needed terminate its survivors in a bounded TERM -> KILL sequence.
        cleanup_term, cleanup_killed = _quiesce_surviving_claude_group(
            proc.pid, grace
        )
        term_signalled = term_signalled or cleanup_term
        killed = killed or cleanup_killed

        return ClaudeRun(
            stdout=stdout or "",
            stderr=stderr or "",
            returncode=proc.returncode,
            timed_out=timed_out,
            term_signalled=term_signalled,
            killed=killed,
            pid=proc.pid,
        )
    except ClaudeLifecycleError:
        raise
    except BaseException:
        # Any unexpected failure while supervising the process must still not
        # leak Claude or its descendants. Best-effort kill the whole group,
        # reap the direct child, then re-raise for the caller to fail closed.
        _signal_claude_group(proc.pid, signal.SIGKILL)
        _force_reap_direct(proc)
        raise



def response(handler, status_code, payload):
    body = json.dumps(payload).encode()
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def do_GET(self):
        if self.path == "/health":
            return response(self, 200, {
                "ok": True,
                "service": "jarvis-claude-bridge",
                "version": 4
            })

        return response(self, 404, {"ok": False})

    def do_POST(self):
        if self.path != "/v1/run":
            return response(self, 404, {"ok": False})

        auth = self.headers.get("Authorization", "")
        if auth != f"Bearer {TOKEN}":
            return response(
                self,
                401,
                {"ok": False, "error": "UNAUTHORIZED"}
            )

        try:
            length = int(
                self.headers.get("Content-Length", "0")
            )

            if length <= 0 or length > 50000:
                raise ValueError("invalid body size")

            data = json.loads(self.rfile.read(length))
            prompt = str(
                data.get("prompt", "")
            ).strip()
            project = str(
                data.get("project", "")
            ).strip()
            mode = str(
                data.get("mode", "review")
            ).strip()
            correlation_id = str(
                data.get("correlation_id", "")
            ).strip().lower()
            # Capability negotiation: legacy JARVIS adapters omit this
            # field, so the existing stateless path remains byte-for-byte the
            # default. Only the authenticated native-session adapter opts in.
            native_session = data.get("native_session") is True
            native_resume = native_session and data.get("native_resume") is True

            if not prompt or len(prompt) > 20000:
                raise ValueError("invalid prompt")

            if native_session:
                if not UUID_RE.fullmatch(correlation_id):
                    raise ValueError("native session requires JARVIS correlation_id")
            elif native_resume:
                raise ValueError("native resume requires native session mode")

            cwd = ROOT

            if project:
                candidate = (ROOT / project).resolve()

                if (
                    ROOT not in candidate.parents
                    and candidate != ROOT
                ):
                    raise ValueError("invalid project path")

                if not candidate.is_dir():
                    raise ValueError(
                        "project does not exist"
                    )

                cwd = candidate

            if mode not in {"review", "implement", "conversation"}:
                raise ValueError("invalid mode")

            if mode == "conversation":
                allowed_tools = []
            elif mode == "review":
                allowed_tools = [
                    "Read",
                    "Glob",
                    "Grep",
                    "Agent"
                ]
            else:
                allowed_tools = [
                    "Read",
                    "Glob",
                    "Grep",
                    "Edit",
                    "Write",
                    "Agent"
                ]

            effective_prompt = prompt

            if mode == "implement":
                effective_prompt = (
                    "STRICT JARVIS IMPLEMENTATION MODE.\n"
                    "Use only the tools made available by this session.\n"
                    "Do not request or attempt Bash, shell, git, network, "
                    "package-manager, MCP, skill, deployment, secret, billing, "
                    "DNS, PR, merge, commit or push actions.\n"
                    "Normal Claude is the sole Edit/Write actor. A JARVIS specialist "
                    "Agent is read-only and may be used only when the routing guidance "
                    "says it materially improves quality; prefer zero or one specialist.\n"
                    "Do not access credential or secret files.\n"
                    "The JARVIS bridge independently performs PRE/POST Git, "
                    "filesystem and tool-audit verification.\n"
                    "Only make the bounded workspace changes explicitly "
                    "authorized below.\n\n"
                    + prompt
                )

            permission_mode = (
                "dontAsk"
                if mode in {"review", "conversation"}
                else "acceptEdits"
            )

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
                "--restricted",
                "--strict-mcp-config",
                "--disable-slash-commands"
            ]

            if native_session:
                if native_resume:
                    cmd.extend(["--resume", correlation_id])
                else:
                    cmd.extend(["--session-id", correlation_id])
            else:
                cmd.append("--no-session-persistence")

            if mode == "conversation":
                # Dedicated low-latency response drafting lane: no repo tools,
                # no specialists, no JARVIS engineering enhancement prompt.
                # The caller supplies bounded application context as data.
                cmd.extend(["--tools", ""])
            else:
                cmd.extend([
                    "--append-system-prompt",
                    ENHANCEMENT_PROMPT,
                    "--agents",
                    ENHANCEMENT_AGENTS_JSON,
                    "--tools",
                    ",".join(allowed_tools)
                ])

            with LOCK:
                pre_git = git_state(cwd)
                pre_snapshot = None if mode == "conversation" else workspace_snapshot(cwd)

                if mode == "implement":
                    if not pre_git.get("is_repo"):
                        return response(self, 409, {
                            "ok": False,
                            "error": "IMPLEMENT_REQUIRES_GIT_REPOSITORY",
                            "git_evidence": {
                                "pre": pre_git
                            }
                        })

                    if pre_git.get("clean") is not True and not safe_repair_dirty_status(pre_git):
                        return response(self, 409, {
                            "ok": False,
                            "error": "IMPLEMENT_REQUIRES_CLEAN_OR_SAFE_REPAIR_WORKSPACE",
                            "git_evidence": {
                                "pre": pre_git
                            }
                        })

                    if not pre_snapshot["summary"]["complete"]:
                        return response(self, 409, {
                            "ok": False,
                            "error": "PRE_SNAPSHOT_INCOMPLETE",
                            "filesystem_evidence": {
                                "pre": pre_snapshot["summary"]
                            }
                        })

                proc = run_claude_bounded(cmd, cwd, 900)
                if proc.timed_out:
                    raise subprocess.TimeoutExpired(cmd=cmd, timeout=900)

                post_git = git_state(cwd)
                if mode == "conversation":
                    git_unchanged = pre_git == post_git
                    changes = {
                        "error": None,
                        "scope": "conversation-no-tools-git-state",
                        "pre_status": pre_git.get("status") or [],
                        "post_status": post_git.get("status") or []
                    }
                    fs_delta = {
                        "complete": True,
                        "pre": {"scope": "conversation-no-tools-git-state"},
                        "post": {"scope": "conversation-no-tools-git-state"},
                        "unchanged": git_unchanged,
                        "added": [],
                        "removed": [],
                        "changed": [],
                        "added_count": 0 if git_unchanged else 1,
                        "removed_count": 0,
                        "changed_count": 0 if git_unchanged else 1,
                        "paths_truncated": False,
                        "scope": "NO_TOOLS_CONVERSATION_MODE; pre/post git state compared; ignored files not scanned"
                    }
                else:
                    post_snapshot = workspace_snapshot(cwd)
                    changes = git_change_evidence(cwd)
                    fs_delta = snapshot_delta(
                        pre_snapshot,
                        post_snapshot
                    )
                audit = parse_claude_stream(
                    proc.stdout,
                    cwd,
                    allowed_tools
                )

            native_session_observed = audit.get("session_id")
            native_session_ok = (
                not native_session
                or native_session_observed == correlation_id
            )

            bridge_ok = (
                proc.returncode == 0
                and native_session_ok
                and audit["complete"]
                and audit["compliant"]
                and fs_delta["complete"]
                and (mode != "conversation" or fs_delta["unchanged"] is True)
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
                        pre_git.get("head")
                        == post_git.get("head")
                    ),
                    "changes": changes
                },
                "filesystem_evidence": fs_delta,
                "tool_audit": audit,
                "native_session": {
                    "enabled": native_session,
                    "resume": native_resume if native_session else False,
                    "requested_session_id": correlation_id if native_session else None,
                    "observed_session_id": native_session_observed,
                    "binding_verified": native_session_ok
                },
                "stderr": proc.stderr[-20000:]
            })

        except subprocess.TimeoutExpired:
            return response(self, 504, {
                "ok": False,
                "error": "CLAUDE_TIMEOUT"
            })

        except Exception as e:
            return response(self, 400, {
                "ok": False,
                "error": str(e)[:500]
            })


ThreadingHTTPServer(
    (HOST, PORT),
    Handler
).serve_forever()

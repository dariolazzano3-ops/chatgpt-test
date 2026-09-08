import hashlib
import json
import os
import stat
import subprocess
import threading
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "0.0.0.0"
PORT = 8788
ROOT = Path("/workspace/projects").resolve()
TOKEN_FILE = Path("/home/claude/.claude/bridge_token")
LOCK = threading.Lock()

SNAPSHOT_MAX_ENTRIES = 100000
SNAPSHOT_MAX_BYTES = 512 * 1024 * 1024
DELTA_PATH_LIMIT = 1000

TOKEN = TOKEN_FILE.read_text().strip()


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

            if not prompt or len(prompt) > 20000:
                raise ValueError("invalid prompt")

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

            if mode not in {"review", "implement"}:
                raise ValueError("invalid mode")

            if mode == "review":
                allowed_tools = [
                    "Read",
                    "Glob",
                    "Grep"
                ]
            else:
                allowed_tools = [
                    "Read",
                    "Glob",
                    "Grep",
                    "Edit",
                    "Write"
                ]

            effective_prompt = prompt

            if mode == "implement":
                effective_prompt = (
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
                    + prompt
                )

            permission_mode = (
                "dontAsk"
                if mode == "review"
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
                "--no-session-persistence",
                "--restricted",
                "--strict-mcp-config",
                "--disable-slash-commands",
                "--tools",
                ",".join(allowed_tools)
            ]

            with LOCK:
                pre_git = git_state(cwd)
                pre_snapshot = workspace_snapshot(cwd)

                if mode == "implement":
                    if not pre_git.get("is_repo"):
                        return response(self, 409, {
                            "ok": False,
                            "error": "IMPLEMENT_REQUIRES_GIT_REPOSITORY",
                            "git_evidence": {
                                "pre": pre_git
                            }
                        })

                    if pre_git.get("clean") is not True:
                        return response(self, 409, {
                            "ok": False,
                            "error": "IMPLEMENT_REQUIRES_CLEAN_WORKSPACE",
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

                proc = subprocess.run(
                    cmd,
                    cwd=str(cwd),
                    capture_output=True,
                    text=True,
                    timeout=900
                )

                post_git = git_state(cwd)
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
                        pre_git.get("head")
                        == post_git.get("head")
                    ),
                    "changes": changes
                },
                "filesystem_evidence": fs_delta,
                "tool_audit": audit,
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

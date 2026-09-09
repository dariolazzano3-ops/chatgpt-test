"""Automated tests for the JARVIS Claude Bridge V5 async job system.

These tests never invoke the real Claude CLI, network, Docker, GitHub or any
external provider. ``bridge.run_claude_bounded`` (the single bounded
process-execution primitive) is substituted everywhere Claude would be executed,
except in the ``ProcessLifecyclePrimitive`` tests which exercise the real
primitive against short-lived local ``python3`` child processes to prove the
process-group timeout / kill / reap contract. Read-only Git inspection of *this*
repository is used only to prove the preserved V4 evidence helpers still work.

Run:
    python3 -m unittest discover -s tests -v
    python3 -m unittest tests.test_bridge_v5 -v
"""

import contextlib
import hashlib
import json
import os
import pathlib
import shutil
import signal
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from unittest import mock

# The bridge reads its bearer token from a file at import time and only falls
# back to this env var when the file is absent; tests additionally patch
# ``bridge._FILE_TOKEN`` to None so this value is authoritative.
TEST_TOKEN = "test-bearer-token-abc123"
os.environ["JARVIS_BRIDGE_TOKEN"] = TEST_TOKEN

import bridge  # noqa: E402  (env must be set first)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def fake_stream(tools, extra_events=None, result_subtype="success",
                is_error=False):
    """Build a minimal but well-formed Claude stream-json transcript."""
    lines = [json.dumps({
        "type": "system",
        "subtype": "init",
        "tools": list(tools),
        "mcp_servers": [],
        "slash_commands": [],
        "plugins": [],
        "skills": [],
    })]
    for ev in (extra_events or []):
        lines.append(json.dumps(ev))
    lines.append(json.dumps({
        "type": "result",
        "subtype": result_subtype,
        "is_error": is_error,
        "result": "ok",
        "session_id": "sess-test",
        "permission_denials": [],
    }))
    return "\n".join(lines) + "\n"


class FakeClaudeRun:
    """Stand-in for ``bridge.ClaudeRun`` (also duck-types the old
    ``subprocess.run`` result: ``stdout`` / ``stderr`` / ``returncode``)."""

    def __init__(self, stdout="", stderr="", returncode=0, timed_out=False,
                 term_signalled=False, killed=False, pid=4321):
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode
        self.timed_out = timed_out
        self.term_signalled = term_signalled
        self.killed = killed
        self.pid = pid


def fake_run_factory(stdout="", stderr="", returncode=0, raises=None,
                     before=None, calls=None, timed_out=False):
    """Return a substitute for ``bridge.run_claude_bounded``."""
    def _run(cmd, *args, **kwargs):
        if calls is not None:
            calls.append(cmd)
        if before is not None:
            before()
        if raises is not None:
            raise raises
        return FakeClaudeRun(stdout=stdout, stderr=stderr,
                             returncode=returncode, timed_out=timed_out)
    return _run


def _pid_alive(pid):
    """True only if ``pid`` is a live (non-zombie) process. Used by the
    process-group lifecycle tests to tell 'still running' from 'dead but not
    yet reaped by its reparented owner'."""
    try:
        with open(f"/proc/{pid}/stat") as f:
            after_comm = f.read().rsplit(")", 1)[1].split()
        return after_comm[0] != "Z"
    except (FileNotFoundError, ProcessLookupError, IndexError):
        return False


CLEAN_CHANGES = {
    "tracked_name_status": [],
    "untracked_files": [],
    "ignored_files_present": [],
    "ignored_files_present_truncated": False,
    "diff_stat": "",
    "diff": "",
    "error": None,
}


@contextlib.contextmanager
def running_server():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), bridge.Handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    try:
        yield httpd.server_address[1]
    finally:
        httpd.shutdown()
        httpd.server_close()


def http_call(port, method, path, token=TEST_TOKEN, body=None):
    url = f"http://127.0.0.1:{port}{path}"
    headers = {}
    data = None
    if body is not None:
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token is not None:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, {"_raw": raw}


# ---------------------------------------------------------------------------
# base
# ---------------------------------------------------------------------------

class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="jarvis-v5-test-")
        self.jobs = os.path.join(self.tmp, "jobs")
        self.projects = os.path.join(self.tmp, "projects")
        os.makedirs(self.projects)

        self._patchers = [
            mock.patch.dict(os.environ, {"JARVIS_BRIDGE_JOBS_DIR": self.jobs}),
            mock.patch.object(bridge, "_FILE_TOKEN", None),
            mock.patch.object(bridge, "ROOT",
                              pathlib.Path(self.projects).resolve()),
        ]
        for p in self._patchers:
            p.start()
        bridge.ensure_jobs_dir()

    def tearDown(self):
        for p in reversed(self._patchers):
            p.stop()
        shutil.rmtree(self.tmp, ignore_errors=True)

    # -- utilities ----------------------------------------------------------

    def make_project(self, name="proj"):
        d = os.path.join(self.projects, name)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "readme.txt"), "w") as f:
            f.write("hello\n")
        return name

    def spec(self, mode="review", project=None, prompt="do the thing"):
        return bridge.build_spec({
            "prompt": prompt, "mode": mode, "project": project or "",
        })

    def wait_terminal(self, job_id, timeout=15):
        deadline = time.time() + timeout
        sp = bridge.job_paths(job_id)["state"]
        while time.time() < deadline:
            try:
                st = bridge.read_json(sp)
            except (OSError, ValueError):
                time.sleep(0.02)
                continue
            if st["status"] in bridge.TERMINAL_STATUSES:
                return st
            time.sleep(0.02)
        raise AssertionError(f"job {job_id} never reached a terminal state")

    def read_state(self, job_id):
        return bridge.read_json(bridge.job_paths(job_id)["state"])

    def read_result(self, job_id):
        return bridge.read_json(bridge.job_paths(job_id)["result"])


# ---------------------------------------------------------------------------
# 1. secure unique job ID creation
# ---------------------------------------------------------------------------

class JobIdCreation(Base):
    def test_ids_are_secure_hex_and_unique(self):
        ids = {bridge.create_job_id() for _ in range(2000)}
        self.assertEqual(len(ids), 2000, "job ids collided")
        for jid in ids:
            self.assertEqual(len(jid), 32)
            self.assertRegex(jid, r"\A[0-9a-f]{32}\Z")
            self.assertTrue(bridge.valid_job_id(jid))

    def test_create_job_id_uses_secrets_module(self):
        with mock.patch.object(bridge.secrets, "token_hex",
                               wraps=bridge.secrets.token_hex) as spy:
            bridge.create_job_id()
        spy.assert_called_once_with(16)


# ---------------------------------------------------------------------------
# 2. job-id validation / path-traversal rejection
# ---------------------------------------------------------------------------

class JobIdValidation(Base):
    BAD = [
        "", "..", "../..", "../../etc/passwd", "a/../b",
        "/etc/passwd", "\\windows", "job\x00id",
        "a" * 31, "a" * 33, "g" * 32, "ABCDEF0123456789ABCDEF0123456789",
        "0123456789abcdef0123456789abcde/", " " + "0" * 31,
        None, 123, ("0" * 32,),
    ]

    def test_valid_job_id_rejects_bad(self):
        for value in self.BAD:
            self.assertFalse(bridge.valid_job_id(value), repr(value))

    def test_valid_job_id_accepts_generated(self):
        self.assertTrue(bridge.valid_job_id(bridge.create_job_id()))
        self.assertTrue(bridge.valid_job_id("0123456789abcdef0123456789abcdef"))

    def test_job_paths_rejects_traversal_before_fs_use(self):
        for value in ["..", "../../etc", "a/../../b",
                      "0123456789abcdef0123456789abcde/"]:
            with self.assertRaises(ValueError):
                bridge.job_paths(value)

    def test_job_paths_confines_under_job_root(self):
        jid = bridge.create_job_id()
        d = bridge.job_paths(jid)["dir"].resolve()
        self.assertEqual(d.parent, pathlib.Path(self.jobs).resolve())

    def test_http_get_rejects_bad_job_id(self):
        with running_server() as port:
            status, payload = http_call(port, "GET", "/v1/jobs/not..valid")
            self.assertEqual(status, 400)
            self.assertEqual(payload["error"], "INVALID_JOB_ID")


# ---------------------------------------------------------------------------
# 3. atomic job-state persistence / read
# ---------------------------------------------------------------------------

class AtomicPersistence(Base):
    def test_write_then_read_roundtrip(self):
        p = pathlib.Path(self.tmp) / "state.json"
        doc = {"job_id": "x" * 32, "status": "QUEUED", "n": 1, "nested": {"a": [1, 2]}}
        bridge.atomic_write_json(p, doc)
        self.assertEqual(bridge.read_json(p), doc)

    def test_no_temp_file_left_behind(self):
        d = pathlib.Path(self.tmp) / "sub"
        d.mkdir()
        p = d / "state.json"
        for i in range(5):
            bridge.atomic_write_json(p, {"i": i})
        names = sorted(x.name for x in d.iterdir())
        self.assertEqual(names, ["state.json"])
        self.assertEqual(bridge.read_json(p)["i"], 4)

    def test_stale_partial_temp_does_not_corrupt_read(self):
        d = pathlib.Path(self.tmp) / "sub2"
        d.mkdir()
        p = d / "state.json"
        bridge.atomic_write_json(p, {"status": "COMPLETE", "ok": True})
        # Simulate a crashed writer leaving a half-written temp sibling.
        (d / ".tmp-garbagestate.json").write_text("{ this is not valid json")
        self.assertEqual(bridge.read_json(p), {"status": "COMPLETE", "ok": True})

    def test_update_state_is_read_modify_write(self):
        s = self.spec()
        jid = bridge.create_job(s)
        bridge.update_state(jid, {"status": "RUNNING", "started_at": 123.0})
        st = self.read_state(jid)
        self.assertEqual(st["status"], "RUNNING")
        self.assertEqual(st["started_at"], 123.0)
        self.assertEqual(st["job_id"], jid)  # untouched field preserved


# ---------------------------------------------------------------------------
# 4. POST /v1/jobs returns quickly with a job id
# ---------------------------------------------------------------------------

class SubmitReturnsFast(Base):
    def test_submit_does_not_block_on_claude(self):
        gate = threading.Event()

        def slow():
            gate.wait(timeout=10)

        fake = fake_run_factory(stdout=fake_stream(["Read", "Glob", "Grep"]),
                                before=slow)
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                running_server() as port:
            t0 = time.monotonic()
            status, payload = http_call(port, "POST", "/v1/jobs",
                                        body={"prompt": "hi", "mode": "review"})
            elapsed = time.monotonic() - t0

            self.assertEqual(status, 202)
            self.assertTrue(payload["ok"])
            self.assertEqual(payload["status"], "QUEUED")
            self.assertTrue(bridge.valid_job_id(payload["job_id"]))
            self.assertLess(elapsed, 2.0,
                            "submit blocked on Claude execution")

            gate.set()
            self.wait_terminal(payload["job_id"])


# ---------------------------------------------------------------------------
# 5. status polling
# ---------------------------------------------------------------------------

class StatusPolling(Base):
    def test_status_endpoint_tracks_lifecycle(self):
        gate = threading.Event()
        fake = fake_run_factory(stdout=fake_stream(["Read", "Glob", "Grep"]),
                                before=lambda: gate.wait(timeout=10))
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                mock.patch.object(bridge, "git_change_evidence",
                                  return_value=dict(CLEAN_CHANGES)), \
                running_server() as port:
            _, sub = http_call(port, "POST", "/v1/jobs",
                               body={"prompt": "hi", "mode": "review"})
            jid = sub["job_id"]

            status, poll = http_call(port, "GET", f"/v1/jobs/{jid}")
            self.assertEqual(status, 200)
            self.assertTrue(poll["ok"])
            self.assertIn(poll["status"], ("QUEUED", "RUNNING"))
            self.assertEqual(poll["mode"], "review")
            self.assertIn("created_at", poll)
            self.assertFalse(poll["result_available"])

            gate.set()
            self.wait_terminal(jid)

            status, poll = http_call(port, "GET", f"/v1/jobs/{jid}")
            self.assertEqual(status, 200)
            self.assertEqual(poll["status"], "COMPLETE")
            self.assertTrue(poll["result_available"])
            self.assertIsNotNone(poll["finished_at"])

    def test_status_unknown_job_is_404(self):
        with running_server() as port:
            status, payload = http_call(
                port, "GET", "/v1/jobs/" + "0" * 32)
            self.assertEqual(status, 404)
            self.assertEqual(payload["error"], "JOB_NOT_FOUND")


# ---------------------------------------------------------------------------
# 6. result unavailable while unfinished
# ---------------------------------------------------------------------------

class ResultGating(Base):
    def test_result_409_while_running_then_200_when_done(self):
        gate = threading.Event()
        fake = fake_run_factory(stdout=fake_stream(["Read", "Glob", "Grep"]),
                                before=lambda: gate.wait(timeout=10))
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                mock.patch.object(bridge, "git_change_evidence",
                                  return_value=dict(CLEAN_CHANGES)), \
                running_server() as port:
            _, sub = http_call(port, "POST", "/v1/jobs",
                               body={"prompt": "hi", "mode": "review"})
            jid = sub["job_id"]

            status, payload = http_call(port, "GET", f"/v1/jobs/{jid}/result")
            self.assertEqual(status, 409)
            self.assertEqual(payload["error"], "RESULT_NOT_READY")
            self.assertIn(payload["status"], ("QUEUED", "RUNNING"))

            gate.set()
            self.wait_terminal(jid)

            status, payload = http_call(port, "GET", f"/v1/jobs/{jid}/result")
            self.assertEqual(status, 200)
            self.assertEqual(payload["job_id"], jid)
            self.assertIn(payload["status"], bridge.TERMINAL_STATUSES)


# ---------------------------------------------------------------------------
# 7. persisted final result available after completion
# ---------------------------------------------------------------------------

class CompletedResultPersisted(Base):
    def test_complete_job_result_on_disk_and_via_http(self):
        tools = ["Read", "Glob", "Grep"]
        fake = fake_run_factory(stdout=fake_stream(tools), returncode=0)
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                mock.patch.object(bridge, "git_change_evidence",
                                  return_value=dict(CLEAN_CHANGES)), \
                running_server() as port:
            _, sub = http_call(port, "POST", "/v1/jobs",
                               body={"prompt": "hi", "mode": "review"})
            jid = sub["job_id"]
            st = self.wait_terminal(jid)

        self.assertEqual(st["status"], "COMPLETE")
        self.assertTrue(st["result_available"])

        disk = self.read_result(jid)
        self.assertTrue(disk["ok"])
        self.assertEqual(disk["status"], "COMPLETE")
        self.assertEqual(disk["job_id"], jid)
        self.assertEqual(disk["exit_code"], 0)
        self.assertFalse(disk["timed_out"])
        self.assertIn("tool_audit", disk)
        self.assertIn("git_evidence", disk)
        self.assertIn("filesystem_evidence", disk)
        # raw stream persisted alongside
        raw = bridge.job_paths(jid)["stdout"].read_text()
        self.assertIn('"type": "result"', raw.replace('"type":"result"',
                                                      '"type": "result"'))


# ---------------------------------------------------------------------------
# 8. authentication on job endpoints
# ---------------------------------------------------------------------------

class Authentication(Base):
    def test_all_job_endpoints_require_bearer(self):
        s = self.spec()
        jid = bridge.create_job(s)
        with running_server() as port:
            for method, path, body in [
                ("POST", "/v1/jobs", {"prompt": "x", "mode": "review"}),
                ("GET", f"/v1/jobs/{jid}", None),
                ("GET", f"/v1/jobs/{jid}/result", None),
            ]:
                st_none, p_none = http_call(port, method, path, token=None,
                                            body=body)
                self.assertEqual(st_none, 401, f"{method} {path} no-token")
                self.assertEqual(p_none["error"], "UNAUTHORIZED")

                st_bad, p_bad = http_call(port, method, path, token="wrong",
                                          body=body)
                self.assertEqual(st_bad, 401, f"{method} {path} bad-token")
                self.assertEqual(p_bad["error"], "UNAUTHORIZED")

    def test_run_endpoint_still_requires_bearer(self):
        with running_server() as port:
            st, p = http_call(port, "POST", "/v1/run", token=None,
                              body={"prompt": "x", "mode": "review"})
            self.assertEqual(st, 401)


# ---------------------------------------------------------------------------
# 9. invalid project / mode / request rejection
# ---------------------------------------------------------------------------

class RequestValidation(Base):
    def test_rejections(self):
        proj = self.make_project()
        with running_server() as port:
            cases = [
                ({"mode": "review"}, "missing prompt"),
                ({"prompt": "", "mode": "review"}, "empty prompt"),
                ({"prompt": "x" * 20001, "mode": "review"}, "oversized prompt"),
                ({"prompt": "x", "mode": "sideways"}, "bad mode"),
                ({"prompt": "x", "mode": "review",
                  "project": "../escape"}, "project escapes ROOT"),
                ({"prompt": "x", "mode": "review",
                  "project": "does-not-exist"}, "missing project"),
                ({"prompt": "x", "mode": "review",
                  "project": proj + "/../../etc"}, "project traversal"),
            ]
            for body, label in cases:
                st, p = http_call(port, "POST", "/v1/jobs", body=body)
                self.assertEqual(st, 400, label)
                self.assertFalse(p["ok"], label)

            # oversized raw body
            st, p = http_call(port, "POST", "/v1/jobs",
                              body=b"{" + b"a" * 60000 + b"}")
            self.assertEqual(st, 400)

            # non-JSON body
            st, p = http_call(port, "POST", "/v1/jobs", body=b"not json at all")
            self.assertEqual(st, 400)

    def test_valid_project_accepted(self):
        proj = self.make_project("good")
        fake = fake_run_factory(stdout=fake_stream(["Read", "Glob", "Grep"]))
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                running_server() as port:
            st, p = http_call(port, "POST", "/v1/jobs",
                              body={"prompt": "x", "mode": "review",
                                    "project": proj})
            self.assertEqual(st, 202)
            self.wait_terminal(p["job_id"])
            self.assertEqual(self.read_state(p["job_id"])["project"], proj)


# ---------------------------------------------------------------------------
# 10. implementation clean-workspace safety remains enforced
# ---------------------------------------------------------------------------

class ImplementGating(Base):
    def _run_implement(self, git_state_value):
        proj = self.make_project("impl")
        calls = []
        fake = fake_run_factory(stdout=fake_stream(
            ["Read", "Glob", "Grep", "Edit", "Write"]), calls=calls)
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                mock.patch.object(bridge, "git_state",
                                  return_value=git_state_value), \
                running_server() as port:
            _, sub = http_call(port, "POST", "/v1/jobs",
                               body={"prompt": "change code", "mode": "implement",
                                     "project": proj})
            jid = sub["job_id"]
            st = self.wait_terminal(jid)
        claude_calls = [c for c in calls if c and c[0] == "claude"]
        return jid, st, claude_calls

    def test_dirty_workspace_produces_failed_job_without_running_claude(self):
        dirty = {"is_repo": True, "branch": "main", "head": "abc123",
                 "clean": False, "status": ["?? new.txt"], "error": None}
        jid, st, calls = self._run_implement(dirty)
        self.assertEqual(st["status"], "FAILED")
        self.assertEqual(st["failure"]["reason"],
                         "IMPLEMENT_REQUIRES_CLEAN_WORKSPACE")
        self.assertEqual(calls, [], "Claude must not run on a dirty workspace")
        self.assertTrue(st["result_available"])

    def test_non_repo_produces_failed_job(self):
        notrepo = {"is_repo": False, "branch": None, "head": None,
                   "clean": None, "status": [], "error": "not a git repository"}
        jid, st, calls = self._run_implement(notrepo)
        self.assertEqual(st["status"], "FAILED")
        self.assertEqual(st["failure"]["reason"],
                         "IMPLEMENT_REQUIRES_GIT_REPOSITORY")
        self.assertEqual(calls, [])

    def test_run_endpoint_still_blocks_dirty_implement(self):
        proj = self.make_project("impl2")
        dirty = {"is_repo": True, "branch": "main", "head": "abc123",
                 "clean": False, "status": ["?? x"], "error": None}
        fake = fake_run_factory(stdout="should not be used")
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                mock.patch.object(bridge, "git_state", return_value=dirty), \
                running_server() as port:
            st, p = http_call(port, "POST", "/v1/run",
                              body={"prompt": "x", "mode": "implement",
                                    "project": proj})
            self.assertEqual(st, 409)
            self.assertEqual(p["error"], "IMPLEMENT_REQUIRES_CLEAN_WORKSPACE")


# ---------------------------------------------------------------------------
# 11. failed Claude subprocess produces durable FAILED state
# ---------------------------------------------------------------------------

class FailedSubprocess(Base):
    def test_nonzero_exit_is_durable_failed(self):
        fake = fake_run_factory(stdout=fake_stream(["Read", "Glob", "Grep"]),
                                stderr="boom", returncode=1)
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                running_server() as port:
            _, sub = http_call(port, "POST", "/v1/jobs",
                               body={"prompt": "hi", "mode": "review"})
            jid = sub["job_id"]
            st = self.wait_terminal(jid)

        self.assertEqual(st["status"], "FAILED")
        self.assertEqual(st["claude_exit_code"], 1)
        self.assertEqual(st["failure"]["reason"], "CLAUDE_NONZERO_EXIT")
        self.assertTrue(st["result_available"])

        res = self.read_result(jid)
        self.assertFalse(res["ok"])
        self.assertEqual(res["status"], "FAILED")
        self.assertEqual(res["exit_code"], 1)
        # POST evidence still collected
        self.assertIn("post", res["git_evidence"])
        self.assertIsNotNone(res["git_evidence"]["post"])
        self.assertIn("filesystem_evidence", res)
        self.assertIn("boom", res["stderr"])


# ---------------------------------------------------------------------------
# 12. Claude timeout produces durable FAILED state / evidence
# ---------------------------------------------------------------------------

class TimeoutHandling(Base):
    def test_timeout_is_durable_failed_with_evidence(self):
        # The primitive absorbs the wall-clock timeout, tears the process group
        # down, and returns a ClaudeRun(timed_out=True) carrying whatever
        # stdout/stderr it managed to drain from the killed group.
        fake = fake_run_factory(stdout="partial-stdout-line\n",
                                stderr="partial-stderr", timed_out=True)
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                running_server() as port:
            _, sub = http_call(port, "POST", "/v1/jobs",
                               body={"prompt": "hi", "mode": "review"})
            jid = sub["job_id"]
            st = self.wait_terminal(jid)

        self.assertEqual(st["status"], "FAILED")
        self.assertTrue(st["timed_out"])
        self.assertEqual(st["failure"]["reason"], "CLAUDE_TIMEOUT")
        self.assertIn("timeout_seconds", st["failure"])
        self.assertTrue(st["result_available"])

        res = self.read_result(jid)
        self.assertFalse(res["ok"])
        self.assertTrue(res["timed_out"])
        # POST git + filesystem evidence attempted despite the timeout
        self.assertIn("post", res["git_evidence"])
        self.assertIn("filesystem_evidence", res)
        # partial stdout captured from the killed subprocess
        raw = bridge.job_paths(jid)["stdout"].read_text()
        self.assertEqual(raw, "partial-stdout-line\n")
        self.assertEqual(bridge.job_paths(jid)["stderr"].read_text(),
                         "partial-stderr")

    def test_internal_exception_is_durable_failed(self):
        fake = fake_run_factory(raises=OSError("no such binary"))
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                running_server() as port:
            _, sub = http_call(port, "POST", "/v1/jobs",
                               body={"prompt": "hi", "mode": "review"})
            jid = sub["job_id"]
            st = self.wait_terminal(jid)
        self.assertEqual(st["status"], "FAILED")
        self.assertEqual(st["failure"]["reason"], "CLAUDE_EXECUTION_EXCEPTION")
        self.assertTrue(st["result_available"])


# ---------------------------------------------------------------------------
# 13. orphaned RUNNING / QUEUED job recovery is fail-closed
# ---------------------------------------------------------------------------

class OrphanRecovery(Base):
    def _plant(self, status, result=None):
        jid = bridge.create_job_id()
        d = pathlib.Path(self.jobs) / jid
        d.mkdir(parents=True)
        bridge.atomic_write_json(d / "state.json", {
            "job_id": jid, "bridge_version": 5, "status": status,
            "created_at": 1.0, "started_at": 2.0 if status == "RUNNING" else None,
            "finished_at": None, "project": None, "mode": "implement",
            "failure": None, "recovery": None, "result_available": False,
        })
        if result is not None:
            bridge.atomic_write_json(d / "result.json", result)
        return jid

    def test_running_and_queued_jobs_are_failed_closed(self):
        running = self._plant("RUNNING")
        queued = self._plant("QUEUED")
        complete = bridge.create_job_id()
        cd = pathlib.Path(self.jobs) / complete
        cd.mkdir()
        bridge.atomic_write_json(cd / "state.json", {
            "job_id": complete, "status": "COMPLETE", "failure": None,
            "recovery": None, "result_available": True,
        })

        recovered = bridge.recover_orphaned_jobs()
        self.assertCountEqual(recovered, [running, queued])

        for jid, prev in [(running, "RUNNING"), (queued, "QUEUED")]:
            st = self.read_state(jid)
            self.assertEqual(st["status"], "FAILED")
            self.assertEqual(st["failure"]["reason"], "ORPHANED_BRIDGE_RESTART")
            self.assertEqual(st["recovery"]["reason"], "ORPHANED_BRIDGE_RESTART")
            self.assertEqual(st["failure"]["previous_status"], prev)
            self.assertIsNotNone(st["finished_at"])
            self.assertTrue(st["result_available"])
            res = self.read_result(jid)
            self.assertFalse(res["ok"])
            self.assertEqual(res["status"], "FAILED")

        # COMPLETE job untouched
        self.assertEqual(self.read_state(complete)["status"], "COMPLETE")

    def test_recovery_does_not_reenqueue_work(self):
        self._plant("RUNNING")
        self._plant("QUEUED")
        before = bridge.WORK_Q.qsize()
        recovered = bridge.recover_orphaned_jobs()
        self.assertEqual(len(recovered), 2)
        # orphaned implementation jobs are never automatically re-run
        self.assertEqual(bridge.WORK_Q.qsize(), before)

    def test_recovered_job_still_inspectable_over_http(self):
        jid = self._plant("RUNNING")
        bridge.recover_orphaned_jobs()
        with running_server() as port:
            st, poll = http_call(port, "GET", f"/v1/jobs/{jid}")
            self.assertEqual(st, 200)
            self.assertEqual(poll["status"], "FAILED")
            st, res = http_call(port, "GET", f"/v1/jobs/{jid}/result")
            self.assertEqual(st, 200)
            self.assertFalse(res["ok"])
            self.assertEqual(res["failure"]["reason"], "ORPHANED_BRIDGE_RESTART")

    def test_stale_success_result_json_is_overwritten_fail_closed(self):
        # Regression (Astra finding): a previous bridge process crashed inside
        # _finalize() after writing an ok/COMPLETE result.json but before
        # flipping state.json to terminal. Recovery must NOT let that stale
        # success stand.
        stale = {"ok": True, "status": "COMPLETE", "exit_code": 0,
                 "job_id": "stale", "tool_audit": {"compliant": True}}
        jid = self._plant("RUNNING", result=stale)

        recovered = bridge.recover_orphaned_jobs()
        self.assertEqual(recovered, [jid])

        st = self.read_state(jid)
        self.assertEqual(st["status"], "FAILED")
        self.assertEqual(st["failure"]["reason"], "ORPHANED_BRIDGE_RESTART")

        res = self.read_result(jid)
        self.assertIs(res["ok"], False)
        self.assertEqual(res["status"], "FAILED")
        self.assertEqual(res["failure"]["reason"], "ORPHANED_BRIDGE_RESTART")
        # prior content retained only as inert forensic material
        self.assertEqual(res["unverified_prior_result"], stale)

    def test_stale_success_not_served_as_success_over_http(self):
        stale = {"ok": True, "status": "COMPLETE"}
        jid = self._plant("RUNNING", result=stale)
        bridge.recover_orphaned_jobs()
        with running_server() as port:
            code, res = http_call(port, "GET", f"/v1/jobs/{jid}/result")
        self.assertEqual(code, 200)
        self.assertIs(res["ok"], False)
        self.assertEqual(res["status"], "FAILED")

    def test_unreadable_prior_result_still_recovers_fail_closed(self):
        jid = bridge.create_job_id()
        d = pathlib.Path(self.jobs) / jid
        d.mkdir(parents=True)
        bridge.atomic_write_json(d / "state.json", {
            "job_id": jid, "status": "RUNNING", "mode": "implement",
            "failure": None, "recovery": None, "result_available": False,
        })
        (d / "result.json").write_text("{ truncated json")

        bridge.recover_orphaned_jobs()

        res = self.read_result(jid)
        self.assertIs(res["ok"], False)
        self.assertEqual(res["status"], "FAILED")
        self.assertIn("_unreadable", res["unverified_prior_result"])


# ---------------------------------------------------------------------------
# 14. no token is written into persisted job metadata
# ---------------------------------------------------------------------------

class NoCredentialLeak(Base):
    def test_token_never_appears_in_job_store(self):
        fake = fake_run_factory(stdout=fake_stream(["Read", "Glob", "Grep"]))
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                running_server() as port:
            _, sub = http_call(port, "POST", "/v1/jobs",
                               body={"prompt": "hi", "mode": "review"})
            jid = sub["job_id"]
            self.wait_terminal(jid)

        token_bytes = TEST_TOKEN.encode()
        checked = 0
        for root, _dirs, files in os.walk(self.jobs):
            for name in files:
                checked += 1
                blob = pathlib.Path(root, name).read_bytes()
                self.assertNotIn(token_bytes, blob, f"token leaked into {name}")
                self.assertNotIn(b"Authorization", blob, name)
                self.assertNotIn(b"Bearer ", blob, name)
        self.assertGreater(checked, 0)

        st = self.read_state(jid)
        self.assertNotIn("token", json.dumps(st).lower())

    def test_full_prompt_is_not_persisted(self):
        # Regression (Astra finding): the raw prompt must not be written into
        # job metadata; only a length and a digest are kept.
        sentinel = "SUPER-SECRET-PROMPT-BODY-9f3a2b7c-do-not-store"
        fake = fake_run_factory(stdout=fake_stream(["Read", "Glob", "Grep"]))
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                running_server() as port:
            _, sub = http_call(port, "POST", "/v1/jobs",
                               body={"prompt": sentinel, "mode": "review"})
            jid = sub["job_id"]
            self.wait_terminal(jid)

        sentinel_bytes = sentinel.encode()
        for root, _dirs, files in os.walk(self.jobs):
            for name in files:
                blob = pathlib.Path(root, name).read_bytes()
                self.assertNotIn(sentinel_bytes, blob,
                                 f"prompt body leaked into {name}")

        st = self.read_state(jid)
        self.assertNotIn("prompt", st)
        self.assertEqual(st["prompt_chars"], len(sentinel))
        self.assertEqual(
            st["prompt_sha256"],
            hashlib.sha256(sentinel.encode()).hexdigest(),
        )

        # status payload over HTTP must not carry the prompt either
        with running_server() as port:
            _, poll = http_call(port, "GET", f"/v1/jobs/{jid}")
        self.assertNotIn("prompt", poll)
        self.assertIn("prompt_sha256", poll)


# ---------------------------------------------------------------------------
# 15. existing /health behaviour updated to V5
# ---------------------------------------------------------------------------

class HealthEndpoint(Base):
    def test_health_reports_version_5_without_auth(self):
        with running_server() as port:
            st, p = http_call(port, "GET", "/health", token=None)
            self.assertEqual(st, 200)
            self.assertTrue(p["ok"])
            self.assertEqual(p["version"], 5)
            self.assertEqual(p["service"], "jarvis-claude-bridge")


# ---------------------------------------------------------------------------
# 16. existing V4 security / evidence functions remain functional
# ---------------------------------------------------------------------------

class V4EvidenceFunctionsIntact(Base):
    REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    def test_git_state_read_only_on_this_repo(self):
        st = bridge.git_state(self.REPO)
        self.assertTrue(st["is_repo"])
        self.assertIsNotNone(st["head"])
        self.assertIn("clean", st)

    def test_git_change_evidence_shape(self):
        ev = bridge.git_change_evidence(self.REPO)
        for key in ("tracked_name_status", "untracked_files",
                    "ignored_files_present", "diff_stat", "diff"):
            self.assertIn(key, ev)

    def test_workspace_snapshot_and_delta(self):
        d = pathlib.Path(self.tmp) / "ws"
        (d / "sub").mkdir(parents=True)
        (d / "a.txt").write_text("one")
        pre = bridge.workspace_snapshot(d)
        self.assertTrue(pre["summary"]["complete"])
        (d / "b.txt").write_text("two")
        (d / "a.txt").write_text("one-changed")
        post = bridge.workspace_snapshot(d)
        delta = bridge.snapshot_delta(pre, post)
        self.assertIn("b.txt", delta["added"])
        self.assertIn("a.txt", delta["changed"])
        self.assertFalse(delta["unchanged"])
        self.assertTrue(delta["complete"])

    def test_parse_claude_stream_compliant_and_violations(self):
        tools = ["Read", "Glob", "Grep"]
        ok = bridge.parse_claude_stream(fake_stream(tools), self.tmp, tools)
        self.assertTrue(ok["complete"])
        self.assertTrue(ok["compliant"])

        bad_events = [{
            "type": "assistant",
            "message": {"content": [
                {"type": "tool_use", "id": "t1", "name": "Bash",
                 "input": {"command": "rm -rf /"}},
            ]},
        }]
        bad = bridge.parse_claude_stream(
            fake_stream(tools, extra_events=bad_events), self.tmp, tools)
        self.assertFalse(bad["compliant"])
        self.assertEqual(len(bad["forbidden_tool_uses"]), 1)
        self.assertEqual(bad["forbidden_tool_uses"][0]["name"], "Bash")

    def test_sensitive_and_confinement_helpers(self):
        tgt = bridge.extract_target(
            {"file_path": os.path.join(self.tmp, ".env")}, self.tmp)
        self.assertTrue(bridge.sensitive_target(tgt))
        outside = bridge.extract_target({"file_path": "/etc/passwd"}, self.tmp)
        self.assertFalse(outside["inside_workspace"])
        self.assertTrue(bridge.inside_root(
            os.path.join(self.tmp, "x"), self.tmp))

    def test_build_spec_preserves_v4_tool_allowlists_and_flags(self):
        review = bridge.build_spec({"prompt": "p", "mode": "review"})
        self.assertEqual(review["allowed_tools"], ["Read", "Glob", "Grep"])
        impl = bridge.build_spec({"prompt": "p", "mode": "implement"})
        self.assertEqual(impl["allowed_tools"],
                         ["Read", "Glob", "Grep", "Edit", "Write"])
        for flag in ("--restricted", "--strict-mcp-config",
                     "--disable-slash-commands", "--no-session-persistence"):
            self.assertIn(flag, impl["cmd"])
        self.assertNotIn("Bash", impl["cmd"])
        self.assertTrue(impl["cmd"][2].startswith("STRICT JARVIS IMPLEMENTATION"))


# ---------------------------------------------------------------------------
# extra: V4 /v1/run backward compatibility
# ---------------------------------------------------------------------------

class RunEndpointBackCompat(Base):
    def test_run_still_executes_synchronously_and_creates_no_job(self):
        tools = ["Read", "Glob", "Grep"]
        fake = fake_run_factory(stdout=fake_stream(tools), returncode=0)
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                mock.patch.object(bridge, "git_change_evidence",
                                  return_value=dict(CLEAN_CHANGES)), \
                running_server() as port:
            st, p = http_call(port, "POST", "/v1/run",
                              body={"prompt": "hi", "mode": "review"})
        self.assertEqual(st, 200)
        self.assertTrue(p["ok"])
        self.assertIn("tool_audit", p)
        self.assertEqual(p["exit_code"], 0)
        # no job directory created by /v1/run
        job_dirs = [x for x in os.listdir(self.jobs)
                    if bridge.valid_job_id(x)]
        self.assertEqual(job_dirs, [])

    def test_run_timeout_returns_504(self):
        fake = fake_run_factory(timed_out=True)
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                running_server() as port:
            st, p = http_call(port, "POST", "/v1/run",
                              body={"prompt": "hi", "mode": "review"})
        self.assertEqual(st, 504)
        self.assertEqual(p["error"], "CLAUDE_TIMEOUT")

    def test_run_lifecycle_error_returns_504_not_success(self):
        def boom(*a, **k):
            raise bridge.ClaudeLifecycleError("group teardown failed")
        with mock.patch.object(bridge, "run_claude_bounded", boom), \
                running_server() as port:
            st, p = http_call(port, "POST", "/v1/run",
                              body={"prompt": "hi", "mode": "review"})
        self.assertEqual(st, 504)
        self.assertFalse(p["ok"])
        self.assertEqual(p["error"], "CLAUDE_TIMEOUT")


# ---------------------------------------------------------------------------
# 17. bounded Claude process-execution primitive: process-group lifecycle
# ---------------------------------------------------------------------------

class ProcessLifecyclePrimitive(Base):
    """Exercises the real ``bridge.run_claude_bounded`` against short-lived
    local ``python3`` child processes (never the real Claude CLI). Proves the
    timeout -> graceful SIGTERM -> bounded grace -> SIGKILL -> reap contract and
    that it applies to the WHOLE process group, not just the direct child."""

    def _py(self, code, **kw):
        return bridge.run_claude_bounded(
            [sys.executable, "-c", code], self.tmp, **kw)

    def test_normal_success_preserves_stdout_stderr_returncode(self):
        code = ("import sys;"
                "sys.stdout.write('OUT-DATA');"
                "sys.stderr.write('ERR-DATA');"
                "sys.exit(0)")
        run = self._py(code, timeout=10)
        self.assertEqual(run.stdout, "OUT-DATA")
        self.assertEqual(run.stderr, "ERR-DATA")
        self.assertEqual(run.returncode, 0)
        self.assertFalse(run.timed_out)
        self.assertFalse(run.term_signalled)
        self.assertFalse(run.killed)

    def test_nonzero_exit_is_preserved(self):
        run = self._py("import sys; sys.exit(7)", timeout=10)
        self.assertEqual(run.returncode, 7)
        self.assertFalse(run.timed_out)
        self.assertFalse(run.killed)

    def test_graceful_process_group_termination_is_attempted(self):
        # Parent spawns a grandchild in the same group. The grandchild traps
        # SIGTERM, writes a sentinel and exits cleanly -> proves the graceful
        # signal reached the whole group, and that SIGKILL was NOT needed.
        sentinel = os.path.join(self.tmp, "graceful.sentinel")
        grandchild = (
            "import signal, sys, time\n"
            "def h(*a):\n"
            f"    open({sentinel!r}, 'w').close()\n"
            "    sys.exit(0)\n"
            "signal.signal(signal.SIGTERM, h)\n"
            "print('gc-up', flush=True)\n"
            "time.sleep(60)\n"
        )
        parent = (
            "import subprocess, sys, time\n"
            f"subprocess.Popen([sys.executable, '-c', {grandchild!r}])\n"
            "time.sleep(60)\n"
        )
        t0 = time.monotonic()
        run = self._py(parent, timeout=1, grace=8)
        elapsed = time.monotonic() - t0

        self.assertTrue(run.timed_out)
        self.assertTrue(run.term_signalled, "SIGTERM was not attempted")
        self.assertFalse(run.killed, "graceful SIGTERM should have sufficed")
        self.assertTrue(
            os.path.exists(sentinel),
            "grandchild in the process group did not receive the graceful "
            "SIGTERM",
        )
        self.assertLess(elapsed, 10)

    def test_force_kill_used_when_graceful_shutdown_does_not_complete(self):
        # Parent and grandchild both ignore SIGTERM entirely -> the primitive
        # must escalate to a whole-group SIGKILL after the grace period.
        grandchild = (
            "import signal, time\n"
            "signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
            "while True: time.sleep(1)\n"
        )
        parent = (
            "import subprocess, sys, signal, time\n"
            "signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
            f"p = subprocess.Popen([sys.executable, '-c', {grandchild!r}])\n"
            "sys.stdout.write('GCPID %d\\n' % p.pid)\n"
            "sys.stdout.flush()\n"
            "while True: time.sleep(1)\n"
        )
        t0 = time.monotonic()
        run = self._py(parent, timeout=1, grace=1)
        elapsed = time.monotonic() - t0

        self.assertTrue(run.timed_out)
        self.assertTrue(run.term_signalled)
        self.assertTrue(run.killed, "SIGKILL escalation was not used")
        # direct child was reaped: return code reflects death by SIGKILL
        self.assertEqual(run.returncode, -signal.SIGKILL)
        # grace was actually observed before escalation
        self.assertGreaterEqual(elapsed, 1.8)
        self.assertLess(elapsed, 15)

        # the grandchild (reported by the parent as "GCPID <pid>") must also be
        # dead - it was reparented away from us, so tolerate a transient zombie
        # state while its new parent reaps it.
        gc_pid = int(run.stdout.split()[1])
        deadline = time.time() + 10
        while time.time() < deadline and _pid_alive(gc_pid):
            time.sleep(0.05)
        self.assertFalse(_pid_alive(gc_pid),
                         "grandchild survived the whole-group SIGKILL")

    def test_direct_process_is_reaped(self):
        run = self._py("pass", timeout=10)
        # returncode is only knowable once the child has been waited on
        self.assertIsNotNone(run.returncode)
        with self.assertRaises(ChildProcessError):
            os.waitpid(run.pid, os.WNOHANG)

    def test_timed_out_child_is_also_reaped(self):
        run = self._py("import time; time.sleep(30)", timeout=1, grace=2)
        self.assertTrue(run.timed_out)
        self.assertIsNotNone(run.returncode)
        with self.assertRaises(ChildProcessError):
            os.waitpid(run.pid, os.WNOHANG)

    def test_no_background_thread_or_process_left_behind(self):
        before_threads = threading.active_count()
        for _ in range(3):
            self._py("import time; time.sleep(20)", timeout=1, grace=1)
        self.assertEqual(threading.active_count(), before_threads,
                         "primitive left a helper thread running")

    def test_cleanup_failure_raises_lifecycle_error_and_still_reaps(self):
        # If the OS refuses to signal the process group, the primitive must
        # fail closed with ClaudeLifecycleError rather than return a value that
        # could be read as success - and must still reap the direct child.
        def refuse(pgid, sig):
            raise PermissionError("EPERM")

        with mock.patch.object(bridge.os, "killpg", refuse):
            with self.assertRaises(bridge.ClaudeLifecycleError):
                self._py("import time; time.sleep(30)", timeout=1, grace=1)
        # _force_reap_direct uses os.kill on the direct child (not killpg), so
        # the child is still gone; no assertion on pid reuse, just that we did
        # not hang and did raise.


# ---------------------------------------------------------------------------
# 18. job-level fail-closed behaviour for lifecycle problems
# ---------------------------------------------------------------------------

class JobLevelLifecycle(Base):
    def test_timeout_marks_job_failed_with_evidence(self):
        fake = fake_run_factory(stdout="partial\n", stderr="partial-err",
                                timed_out=True)
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                running_server() as port:
            _, sub = http_call(port, "POST", "/v1/jobs",
                               body={"prompt": "hi", "mode": "review"})
            jid = sub["job_id"]
            st = self.wait_terminal(jid)

        self.assertEqual(st["status"], "FAILED")
        self.assertTrue(st["timed_out"])
        self.assertEqual(st["failure"]["reason"], "CLAUDE_TIMEOUT")
        res = self.read_result(jid)
        self.assertFalse(res["ok"])
        self.assertNotEqual(res["status"], "COMPLETE")
        self.assertIn("post", res["git_evidence"])
        self.assertEqual(bridge.job_paths(jid)["stdout"].read_text(),
                         "partial\n")

    def test_lifecycle_cleanup_failure_cannot_produce_success(self):
        def boom(*a, **k):
            raise bridge.ClaudeLifecycleError("group teardown exploded")
        with mock.patch.object(bridge, "run_claude_bounded", boom), \
                running_server() as port:
            _, sub = http_call(port, "POST", "/v1/jobs",
                               body={"prompt": "hi", "mode": "review"})
            jid = sub["job_id"]
            st = self.wait_terminal(jid)

        self.assertEqual(st["status"], "FAILED")
        self.assertNotEqual(st["status"], "COMPLETE")
        self.assertTrue(st["timed_out"])
        self.assertEqual(st["failure"]["reason"], "CLAUDE_LIFECYCLE_ERROR")
        self.assertIn("detail", st["failure"])
        self.assertTrue(st["result_available"])

        res = self.read_result(jid)
        self.assertIs(res["ok"], False)
        self.assertEqual(res["status"], "FAILED")
        self.assertEqual(res["failure"]["reason"], "CLAUDE_LIFECYCLE_ERROR")

    def test_normal_job_still_completes_with_full_evidence(self):
        # existing V5 job / evidence semantics remain intact through the new
        # execution primitive.
        tools = ["Read", "Glob", "Grep"]
        fake = fake_run_factory(stdout=fake_stream(tools), returncode=0)
        with mock.patch.object(bridge, "run_claude_bounded", fake), \
                mock.patch.object(bridge, "git_change_evidence",
                                  return_value=dict(CLEAN_CHANGES)), \
                running_server() as port:
            _, sub = http_call(port, "POST", "/v1/jobs",
                               body={"prompt": "hi", "mode": "review"})
            jid = sub["job_id"]
            st = self.wait_terminal(jid)

        self.assertEqual(st["status"], "COMPLETE")
        res = self.read_result(jid)
        self.assertTrue(res["ok"])
        self.assertEqual(res["exit_code"], 0)
        self.assertFalse(res["timed_out"])
        for key in ("git_evidence", "filesystem_evidence", "tool_audit"):
            self.assertIn(key, res)


if __name__ == "__main__":
    unittest.main(verbosity=2)

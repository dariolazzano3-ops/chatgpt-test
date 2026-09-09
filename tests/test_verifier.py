import os
import subprocess
from pathlib import Path
from unittest import mock
import bridge
import verifier
from tests.test_bridge_v5 import Base, init_git_repo, FakeClaudeRun, fake_stream


def subprocess_add_commit(path):
    env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@e",
           "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@e",
           "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_SYSTEM": os.devnull}
    for args in (["add", "-A"], ["commit", "-q", "-m", "more"]):
        subprocess.run(["git", "-C", str(path), *args], check=True, env=env, capture_output=True)


class VerifierTests(Base):
    def fixture(self):
        name = self.make_project()
        source = Path(self.projects) / name
        init_git_repo(source)
        spec = self.spec(project=name)
        job = bridge.create_job(spec)
        with mock.patch.object(bridge, 'run_claude_bounded', return_value=FakeClaudeRun(stdout=fake_stream(spec['allowed_tools']))):
            bridge.execute_job(job, spec)
        return bridge.job_paths(job)['dir'], source

    def test_accept_and_readonly(self):
        job, source = self.fixture()
        before = {str(p): p.read_bytes() for root in (job, source) for p in root.rglob('*') if p.is_file()}
        verifier.verify(job, source)
        after = {str(p): p.read_bytes() for root in (job, source) for p in root.rglob('*') if p.is_file()}
        self.assertEqual(before, after)

    def test_source_mutation(self):
        job, source = self.fixture()
        (source / 'readme.txt').write_text('changed')
        with self.assertRaises(ValueError):
            verifier.verify(job, source)

    def test_runtime_rejections(self):
        job, source = self.fixture()
        result = bridge.read_json(job / 'result.json')
        for key, value in [('fallback_attempt_count', 2), ('final_worker', 'codex'), ('source_head_post', 'bad')]:
            changed = dict(result, runtime_truth=dict(result['runtime_truth'], **{key: value}))
            bridge.atomic_write_json(job / 'result.json', changed)
            with self.assertRaises(ValueError):
                verifier.verify(job, source)
        result.pop('runtime_truth')
        bridge.atomic_write_json(job / 'result.json', result)
        with self.assertRaises(KeyError):
            verifier.verify(job, source)

    # --- regression: evidence repos owned by another user -----------------
    # A valid Real-E2E bundle produced by the service UID must still verify when
    # an operator runs the check under a different identity (git would otherwise
    # refuse the repo with "detected dubious ownership" and git_state() would
    # report is_repo=False -> ValueError('source git unavailable')).
    def _foreign_ownership(self):
        """Make git treat every repo as owned by someone else, for the duration
        of one test. GIT_TEST_ASSUME_DIFFERENT_OWNER forces git's safe.directory
        gate exactly as a real UID mismatch would."""
        saved = {k: os.environ.get(k) for k in list(os.environ)
                 if k == 'GIT_TEST_ASSUME_DIFFERENT_OWNER'
                 or k.startswith('GIT_CONFIG_')}

        def restore():
            for k in [k for k in os.environ
                      if k == 'GIT_TEST_ASSUME_DIFFERENT_OWNER'
                      or k.startswith('GIT_CONFIG_')]:
                del os.environ[k]
            for k, v in saved.items():
                if v is not None:
                    os.environ[k] = v
        self.addCleanup(restore)
        os.environ['GIT_TEST_ASSUME_DIFFERENT_OWNER'] = '1'

    def test_valid_bundle_accepts_when_evidence_owned_by_other_user(self):
        job, source = self.fixture()          # built as us, before the switch
        self._foreign_ownership()
        verifier.verify(job, source)          # must NOT raise

    def test_mutated_source_still_rejected_when_evidence_owned_by_other_user(self):
        job, source = self.fixture()
        (source / 'readme.txt').write_text('changed')
        self._foreign_ownership()
        with self.assertRaises(ValueError):   # fail-closed preserved
            verifier.verify(job, source)

    def test_missing_repo_still_rejected_when_evidence_owned_by_other_user(self):
        job, source = self.fixture()
        for entry in (source / '.git').iterdir():
            bridge._safe_rmtree(entry) if entry.is_dir() else entry.unlink()
        (source / '.git').rmdir()
        self._foreign_ownership()
        with self.assertRaises(ValueError):   # not-a-repo must still fail closed
            verifier.verify(job, source)

    # --- regression: the exact failing invariant must be reported ----------
    def test_main_surfaces_exact_reason_not_just_valueerror(self):
        import io, contextlib, sys
        job, source = self.fixture()
        (source / 'readme.txt').write_text('mutated')   # -> a 'source ...' invariant
        argv = sys.argv
        sys.argv = ['verifier', '--job-dir', str(job), '--source', str(source), '-v']
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                rc = verifier.main()
        finally:
            sys.argv = argv
        out = buf.getvalue()
        self.assertEqual(rc, 1)
        self.assertIn('VERIFIER_REJECTED:', out)
        self.assertNotEqual(out.strip(), 'VERIFIER_REJECTED: ValueError')
        self.assertRegex(out, r'VERIFIER_REJECTED: source (git changed|head|changed|filesystem changed)')
        self.assertIn('"invariant"', out)         # -v dumped operands

    # --- regression: operator-asserted mount-prefix remap -----------------
    def test_path_remap_accepts_equal_remapped_path(self):
        # Container mounts the whole sprint pack at /pack; both recorded paths
        # share that prefix. A single --was/--now pair restores exact equality.
        job, source = self.fixture()
        host_root = str(job.parent.parent)              # common ancestor of job dir + source
        result = bridge.read_json(job / 'result.json')
        for key in ('source_project_path', 'execution_workspace_path'):
            result['workspace_evidence'][key] = \
                result['workspace_evidence'][key].replace(host_root, '/pack', 1)
        bridge.atomic_write_json(job / 'result.json', result)
        with self.assertRaises(ValueError):
            verifier.verify(job, source)                # no remap -> reject
        verifier.verify(job, source, path_remap=('/pack', host_root))   # remap -> accept

    def test_path_remap_still_rejects_a_wrong_target(self):
        job, source = self.fixture()
        result = bridge.read_json(job / 'result.json')
        real = result['workspace_evidence']['source_project_path']
        result['workspace_evidence']['source_project_path'] = '/mnt/x/' + Path(real).name
        bridge.atomic_write_json(job / 'result.json', result)
        with self.assertRaises(ValueError):        # remap to the WRONG place still fails
            verifier.verify(job, source, path_remap=('/mnt/x/' + Path(real).name, '/not/the/source'))

    # ================================================================
    # Package A: explicit, deterministic source identity + remount contract
    # historical Real-E2E source: /workspace/projects/dogfood
    # current read-only remount : <evidence>/source
    # ================================================================
    def _remount(self, job, source, old_root):
        """Rewrite every recorded absolute path so the bundle looks like it was
        produced under `old_root` (a container mount), e.g. /workspace/projects."""
        host_root = str(job.parent.parent)
        result = bridge.read_json(job / 'result.json')
        for key in ('source_project_path', 'execution_workspace_path'):
            result['workspace_evidence'][key] = \
                result['workspace_evidence'][key].replace(host_root, old_root, 1)
        bridge.atomic_write_json(job / 'result.json', result)
        return old_root, host_root

    def test_real_e2e_remount_dogfood_accepts_with_explicit_remap(self):
        job, source = self.fixture()
        old, host = self._remount(job, source, '/workspace/projects')
        with self.assertRaises(ValueError):                 # remount, no remap -> reject
            verifier.verify(job, source)
        verifier.verify(job, source, path_remap=[(old, host)])   # explicit remap -> accept
        # list form and (old,new) tuple form are equivalent
        verifier.verify(job, source, path_remap=(old, host))

    def test_exact_runtime_path_still_works_without_remap(self):
        job, source = self.fixture()
        verifier.verify(job, source)                        # untouched bundle, no remap

    def test_different_path_without_remap_fails(self):
        job, source = self.fixture()
        self._remount(job, source, '/somewhere/else')
        with self.assertRaises(ValueError):
            verifier.verify(job, source)

    def test_ambiguous_remap_fails(self):
        job, source = self.fixture()
        old, host = self._remount(job, source, '/workspace/projects')
        with self.assertRaisesRegex(ValueError, 'ambiguous path remap'):
            verifier.verify(job, source, path_remap=[(old, host), (old, host + '/x')])

    def test_root_wildcard_remap_fails(self):
        job, source = self.fixture()
        for bad in ('/', '', '*', '..'):
            with self.assertRaisesRegex(ValueError, 'invalid path remap'):
                verifier.verify(job, source, path_remap=[(bad, str(source.parent))])

    def test_relative_remap_prefix_fails(self):
        job, source = self.fixture()
        with self.assertRaisesRegex(ValueError, 'invalid path remap'):
            verifier.verify(job, source, path_remap=[('workspace/projects', str(source.parent))])

    def test_path_traversal_in_remap_fails(self):
        job, source = self.fixture()
        old, host = self._remount(job, source, '/workspace/projects')
        with self.assertRaisesRegex(ValueError, 'invalid path remap|traversal'):
            verifier.verify(job, source, path_remap=[(old, host + '/../etc')])

    def test_wrong_repo_head_still_fails_under_remap(self):
        job, source = self.fixture()
        old, host = self._remount(job, source, '/workspace/projects')
        (source / 'more.txt').write_text('x')
        subprocess_add_commit(source)                       # advances HEAD past the recorded one
        with self.assertRaises(ValueError):
            verifier.verify(job, source, path_remap=[(old, host)])

    def test_mutated_source_still_fails_under_remap(self):
        job, source = self.fixture()
        old, host = self._remount(job, source, '/workspace/projects')
        (source / 'readme.txt').write_text('changed after the fact')
        with self.assertRaises(ValueError):
            verifier.verify(job, source, path_remap=[(old, host)])

    def test_missing_repo_still_fails_under_remap(self):
        job, source = self.fixture()
        old, host = self._remount(job, source, '/workspace/projects')
        import shutil
        shutil.rmtree(source / '.git')
        with self.assertRaises(ValueError):
            verifier.verify(job, source, path_remap=[(old, host)])

    def test_incorrect_runtime_truth_still_fails_under_remap(self):
        job, source = self.fixture()
        old, host = self._remount(job, source, '/workspace/projects')
        result = bridge.read_json(job / 'result.json')
        result['runtime_truth']['source_head_post'] = 'deadbeef' * 5
        bridge.atomic_write_json(job / 'result.json', result)
        with self.assertRaises(ValueError):
            verifier.verify(job, source, path_remap=[(old, host)])

    def test_forged_source_unchanged_cannot_override_real_validation(self):
        job, source = self.fixture()
        (source / 'readme.txt').write_text('actually changed')
        result = bridge.read_json(job / 'result.json')
        result['workspace_evidence']['source_unchanged'] = True         # forged
        result['runtime_truth']['source_unchanged'] = True              # forged
        bridge.atomic_write_json(job / 'result.json', result)
        with self.assertRaises(ValueError):        # real git/fs comparison still catches it
            verifier.verify(job, source)

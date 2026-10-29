import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('setup', Path(__file__).with_name('setup-runtime-read-gate.py'))
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)

class ReadGateTests(unittest.TestCase):
    def setUp(self):
        self.h = types.ModuleType('readgate')
        exec(compile(setup.HELPER, '<helper>', 'exec'), self.h.__dict__)

    def identity(self):
        return patch.object(self.h.pwd, 'getpwnam', return_value=types.SimpleNamespace(pw_uid=os.geteuid()))

    def test_unknown_actions_and_extra_arguments_rejected_before_git(self):
        with patch.object(self.h, 'git') as git:
            for args in ([], ['install'], ['restart'], ['source', '/etc/shadow'], ['status', '--help']):
                with self.assertRaises(SystemExit):
                    self.h.main(args)
            git.assert_not_called()

    def test_wrong_identity_rejected(self):
        with patch.object(self.h.pwd, 'getpwnam', return_value=types.SimpleNamespace(pw_uid=-1)):
            with self.assertRaises(SystemExit):
                self.h.main(['status'])

    def test_status_only_uses_read_commands(self):
        def read(*args):
            return {('rev-parse','HEAD'): b'a'*40,
                    ('status','--porcelain=v1','--untracked-files=normal'): b'',
                    ('branch','--show-current'): b'factory/runtime'}[args]
        with self.identity(), patch.object(self.h, 'git', side_effect=read), patch('sys.stdout', new_callable=io.StringIO) as out:
            self.h.main(['status'])
            self.assertEqual(json.loads(out.getvalue())['dirty_lines'], 0)

    def test_dirty_runtime_cannot_export_stale_committed_snapshot(self):
        with self.identity(), patch.object(self.h, 'git', side_effect=[b'a'*40, b' M src/file']) as git:
            with self.assertRaises(SystemExit):
                self.h.main(['source'])
            self.assertEqual(git.call_count, 2)

    def test_source_archive_has_fixed_paths_and_pinned_sha(self):
        head = 'a'*40
        output = types.SimpleNamespace(buffer=io.BytesIO())
        with self.identity(), patch.object(self.h, 'git', side_effect=[head.encode(), b'', b'archive']) as git, patch('sys.stdout', output):
            self.h.main(['source'])
            self.assertEqual(output.buffer.getvalue(), b'archive')
            self.assertEqual(git.call_args.args, ('archive', '--format=tar', head, 'src', 'scripts', 'package.json'))

    def test_git_discards_inherited_environment_and_never_uses_shell(self):
        with patch.object(self.h.subprocess, 'run', return_value=types.SimpleNamespace(stdout=b'')) as run:
            self.h.git('rev-parse', 'HEAD')
            self.assertEqual(run.call_args.args[0][:3], ['/usr/bin/git','-C','/opt/jarvis/chatgpt-test'])
            self.assertEqual(run.call_args.kwargs['env'], self.h.ENV)
            self.assertNotIn('shell', run.call_args.kwargs)

    def test_atomic_creation_cannot_replace_existing_file_or_symlink(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)/'target'
            setup.create_atomic(p, 'first', 0o600)
            with self.assertRaises(FileExistsError):
                setup.create_atomic(p, 'replacement', 0o600)
            self.assertEqual(p.read_text(), 'first')
            link = Path(d)/'link'
            link.symlink_to(p)
            with self.assertRaises(FileExistsError):
                setup.create_atomic(link, 'replacement', 0o600)
            self.assertEqual(p.read_text(), 'first')

    def test_bootstrap_refuses_nonroot(self):
        with patch.object(setup.os, 'geteuid', return_value=1000):
            with self.assertRaises(SystemExit):
                setup.main()

    def test_sudo_policy_has_only_exact_operator_read_actions(self):
        self.assertEqual(setup.POLICY.count('NOPASSWD:'), 1)
        self.assertIn('ALL=(jarvis-operator)', setup.POLICY)
        self.assertNotIn('*', setup.POLICY)
        self.assertNotIn(' install', setup.POLICY)
        self.assertNotIn(' restart', setup.POLICY)

if __name__ == '__main__':
    unittest.main()

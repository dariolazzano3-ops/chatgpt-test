import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock
import codex_worker as worker
from tests.test_bridge_v5 import FakeClaudeRun


def stream():
    return '\n'.join(json.dumps(e) for e in [
        {'type': 'thread.started', 'thread_id': 'x'}, {'type': 'turn.started'},
        {'type': 'turn.completed', 'usage': {}}])


def real_events():
    # Codex 0.153.4 observed event order; ellipses expanded to real fields.
    return [
        {'type': 'thread.started', 'thread_id': 'thread-1'},
        {'type': 'turn.started'},
        {'type': 'item.completed', 'item': {'id': 'item_0', 'type': 'agent_message', 'text': 'PRIVATE_PROSE'}},
        {'type': 'item.started', 'item': {'id': 'item_1', 'type': 'command_execution', 'command': 'PRIVATE_COMMAND', 'aggregated_output': '', 'exit_code': None, 'status': 'in_progress'}},
        {'type': 'item.completed', 'item': {'id': 'item_1', 'type': 'command_execution', 'command': 'PRIVATE_COMMAND', 'aggregated_output': 'PRIVATE_OAUTH', 'exit_code': 0, 'status': 'completed'}},
        {'type': 'item.completed', 'item': {'id': 'item_2', 'type': 'agent_message', 'text': 'PRIVATE_PROSE'}},
        {'type': 'turn.completed', 'usage': {'input_tokens': 123, 'cached_input_tokens': 10, 'output_tokens': 45}},
    ]


def encode(events):
    return '\n'.join(json.dumps(e) for e in events)


class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.job = 'a' * 32
        self.ws = self.root / self.job / 'workspace'
        self.ws.mkdir(parents=True)
        self.env = mock.patch.dict(os.environ, {'JARVIS_CODEX_EXCHANGE_ROOT': str(self.root)})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_confinement(self):
        for job in ('../bad', '/tmp', 'A'*32):
            with self.assertRaises(ValueError):
                worker.workspace_for(self.root, job)
        (self.ws / 'escape').symlink_to('/tmp')
        with self.assertRaises(ValueError):
            worker.workspace_for(self.root, self.job)

    def test_foreign_and_git(self):
        (self.root / 'foreign').mkdir()
        with self.assertRaises(ValueError):
            worker.workspace_for(self.root, self.job)
        (self.root / 'foreign').rmdir()
        (self.ws / '.git').mkdir()
        with self.assertRaises(ValueError):
            worker.workspace_for(self.root, self.job)

    def test_modes_and_prompt(self):
        for mode, prompt in [('bad', 'x'), ('review', 'x'*20001)]:
            with self.assertRaises(ValueError):
                worker.run_job(dict(job_id=self.job, mode=mode, prompt=prompt))

    def test_outcomes(self):
        for rc, timeout, output, expected in [(0, False, stream(), True), (1, False, stream(), False), (0, True, stream(), False), (0, False, 'prose', False)]:
            with self.subTest(rc=rc, timeout=timeout, output=output), mock.patch.object(worker, 'run_process', return_value=FakeClaudeRun(stdout=output, returncode=rc, timed_out=timeout)), mock.patch.object(worker.bridge, '_signal_claude_group', return_value=True):
                self.assertEqual(worker.run_job(dict(job_id=self.job, mode='review', prompt='x'))['ok'], expected)

    def test_unknown_event(self):
        self.assertFalse(worker.parse_audit(stream() + '\n{}', self.ws)['compliant'])

    def test_real_stream(self):
        audit = worker.parse_audit(encode(real_events()) + '\n', self.ws)
        self.assertTrue(audit['complete'])
        self.assertTrue(audit['compliant'])
        self.assertEqual(audit['command_count'], 1)
        self.assertTrue(audit['all_commands_completed'])
        self.assertTrue(audit['all_commands_exit_zero'])
        self.assertEqual(audit['item_type_counts'], {'agent_message': 2, 'command_execution': 2})
        self.assertEqual(audit['event_counts'], {'thread.started': 1, 'turn.started': 1, 'item.started': 1, 'item.completed': 3, 'turn.completed': 1})
        for secret in ('PRIVATE_', 'input_tokens', 'output_tokens', 'thread-1', 'item_1'):
            self.assertNotIn(secret, json.dumps(audit))

    def test_real_stream_mutation_modes(self):
        for mode in ('implement', 'review'):
            with self.subTest(mode=mode):
                def mutate(*args, **kwargs):
                    (self.ws / 'intended.txt').write_text(mode)
                    return FakeClaudeRun(stdout=encode(real_events()))
                with mock.patch.object(worker, 'run_process', side_effect=mutate):
                    result = worker.run_job(dict(job_id=self.job, mode=mode, prompt='edit intended.txt'))
                self.assertTrue(result['audit']['compliant'])
                self.assertEqual(result['ok'], mode == 'implement')

    def test_command_failures(self):
        for field, values in {'status': ['failed', 'in_progress', None], 'exit_code': [1, -1, None, False, 0.0, '0']}.items():
            for value in values:
                with self.subTest(field=field, value=value):
                    events = real_events()
                    events[4]['item'][field] = value
                    self.assertFalse(worker.parse_audit(encode(events), self.ws)['compliant'])
        for index in (3, 4):
            events = real_events()
            del events[index]
            self.assertFalse(worker.parse_audit(encode(events), self.ws)['compliant'])
        for index, field, value in [(4, 'id', 'unmatched'), (3, 'id', None), (3, 'status', 'completed'), (3, 'exit_code', 0)]:
            events = real_events()
            events[index]['item'][field] = value
            self.assertFalse(worker.parse_audit(encode(events), self.ws)['compliant'])
        for index in (3, 4):
            events = real_events()
            events.insert(index, events[index])
            self.assertFalse(worker.parse_audit(encode(events), self.ws)['compliant'])

    def test_fail_closed_schemas_and_lifecycle(self):
        base = real_events()
        cases = [base[1:], base[:1] + base[2:], base[:-1],
                 [base[0]] + base, base + [base[-1]], base + [base[2]],
                 [base[1], base[0]] + base[2:]]
        for event in ({'type': 'PRIVATE_UNKNOWN'}, {'type': 'item.updated', 'item': base[3]['item']},
                      {'type': 'item.completed', 'item': {'type': 'PRIVATE_UNKNOWN'}},
                      {'type': 'item.completed', 'item': None}, [], None,
                      {'type': []}, {'type': 'item.completed', 'item': {'type': []}}):
            cases.append(base[:2] + [event] + base[2:])
        for events in cases:
            with self.subTest(events=events):
                audit = worker.parse_audit(encode(events), self.ws)
                self.assertFalse(audit['compliant'])
                self.assertNotIn('PRIVATE_UNKNOWN', json.dumps(audit))
        for bad in ('prose', '{', '', '{"type":"turn.started","type":"turn.started"}', '{"type":"turn.started","value":NaN}'):
            self.assertFalse(worker.parse_audit(encode(base[:2]) + '\n' + bad + '\n' + encode(base[2:]), self.ws)['compliant'])
        events = real_events()
        events.insert(2, {'type': 'turn.started'})
        self.assertTrue(worker.parse_audit(encode(events), self.ws)['compliant'])

    def test_http_auth_and_body_bound(self):
        import threading
        import urllib.request
        import urllib.error
        from http.server import ThreadingHTTPServer
        server = ThreadingHTTPServer(('127.0.0.1', 0), worker.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with mock.patch.dict(os.environ, {'JARVIS_CODEX_WORKER_TOKEN': 'secret'}):
                for token, body, status in [('wrong', b'{}', 401), ('secret', b'x' * (worker.MAX_BODY + 1), 400), ('secret', b'{}', 400)]:
                    req = urllib.request.Request('http://127.0.0.1:%d/v1/run' % server.server_port, data=body, headers={'Authorization': 'Bearer ' + token})
                    with self.assertRaises(urllib.error.HTTPError) as error:
                        urllib.request.urlopen(req)
                    self.assertEqual(error.exception.code, status)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_real_process_timeout(self):
        import sys
        run = worker.run_process([sys.executable, '-c', 'import time; time.sleep(10)'], self.ws, 0.05, os.environ.copy())
        self.assertTrue(run.timed_out)
        self.assertIsNotNone(run.returncode)

    def test_review_mutation(self):
        def mutate(*args, **kwargs):
            (self.ws / 'new').write_text('changed')
            return FakeClaudeRun(stdout=stream())
        with mock.patch.object(worker, 'run_process', side_effect=mutate), mock.patch.object(worker.bridge, '_signal_claude_group', return_value=True):
            self.assertFalse(worker.run_job(dict(job_id=self.job, mode='review', prompt='x'))['ok'])

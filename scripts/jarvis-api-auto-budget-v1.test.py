#!/usr/bin/env python3
"""No-network unit tests for the protected per-job API cap policy."""
import importlib.util
import pathlib
import unittest

module_path=pathlib.Path(__file__).with_name('jarvis-api-auto-budget-v1.py')
spec=importlib.util.spec_from_file_location('jarvis_api_budget_module',module_path)
policy=importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)

class BudgetPolicyTests(unittest.TestCase):
    def test_fallback_enabled_and_cap_fixed(self):
        self.assertEqual(policy.KEYS['JARVIS_AI_API_FALLBACK_ENABLED'],'true')
        self.assertEqual(policy.KEYS['JARVIS_AI_API_FALLBACK_APPROVED'],'true')
        self.assertEqual(policy.KEYS['JARVIS_AI_MAX_JOB_COST_USD'],'0.25')
        self.assertEqual(policy.MAX_USD,0.25)
    def test_preserves_other_config_and_secret(self):
        s='OPENAI_API_KEY=sk-example-not-a-real-key-123456789\nOTHER=keep_me\nJARVIS_AI_API_FALLBACK_ENABLED=false\n'
        result=policy.patched_env(s)
        self.assertIn('OPENAI_API_KEY=sk-example-not-a-real-key-123456789\n',result)
        self.assertIn('OTHER=keep_me\n',result)
        self.assertIn('JARVIS_AI_API_FALLBACK_ENABLED=true\n',result)
        self.assertEqual(result.count('JARVIS_AI_API_FALLBACK_APPROVED='),1)
        self.assertEqual(result.count('JARVIS_AI_MAX_JOB_COST_USD='),1)
        self.assertEqual(policy.patched_env(result),result)
    def test_absent_api_key_blocks_activation(self):
        for s in ('OTHER=ok\n','OPENAI_API_KEY=\n','OPENAI_API_KEY=dummy\n'):
            with self.assertRaises(RuntimeError):
                policy.verify_input(s)
    def test_duplicate_keys_refused(self):
        with self.assertRaises(RuntimeError):
            policy.patched_env('JARVIS_AI_API_FALLBACK_ENABLED=true\nJARVIS_AI_API_FALLBACK_ENABLED=false\n')
    def test_no_side_effects(self):
        self.assertNotIn('api.openai.com',policy.__file__)
        self.assertEqual(policy.MAINT,'/usr/local/sbin/jarvis-maintenance')

if __name__=='__main__':
    unittest.main()

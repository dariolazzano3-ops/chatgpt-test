#!/usr/bin/env python3
"""Read-only preflight for JARVIS isolated Claude write acceptance.
Never changes registry, services, permissions, projects or git state.
Does not inspect or print secrets.
"""
import json
import os
import subprocess
from pathlib import Path

REGISTRY = Path("/opt/jarvis/owner-deploy-queue/project-targets.v1.json")
EXPECTED_ID = "JARVIS_AUTONOMY_TEST"
EXPECTED_REPO = Path("/home/jarvis/jarvis-autonomy-e2e-20261027")
EXPECTED_BRANCH = "factory/jarvis-autonomy-e2e-20261027"

def check(label, ok, detail):
    print(f"{'PASS' if ok else 'BLOCKED'} | {label} | {detail}")
    return ok

def git(repo, *args):
    try:
        return subprocess.run(
            ["git", "-C", str(repo), *args],
            capture_output=True, text=True, timeout=4, check=True
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return None

def main():
    checks = []
    try:
        data = json.loads(REGISTRY.read_text())
        targets = data.get("targets", {})
        checks.append(check("registry readable", True, f"revision={data.get('revision', 'unknown')}; targets={len(targets)}"))
    except (OSError, ValueError, TypeError) as exc:
        print(f"BLOCKED | registry readable | {type(exc).__name__}")
        return 2

    target = targets.get(EXPECTED_ID)
    checks.append(check("disposable target registered", isinstance(target, dict), EXPECTED_ID))
    if isinstance(target, dict):
        actual_repo = Path(str(target.get("repo_dir", "")))
        checks.append(check("target repo exactly scoped", actual_repo == EXPECTED_REPO, str(actual_repo)))
        checks.append(check("target branch exactly scoped", target.get("target_branch") == EXPECTED_BRANCH, str(target.get("target_branch"))))
        checks.append(check("target enabled", target.get("enabled") is True, str(target.get("enabled"))))

    root = git(EXPECTED_REPO, "rev-parse", "--show-toplevel")
    checks.append(check("fixture git repo", root == str(EXPECTED_REPO), str(root)))
    branch = git(EXPECTED_REPO, "branch", "--show-current")
    checks.append(check("fixture branch", branch == EXPECTED_BRANCH, str(branch)))
    dirty = git(EXPECTED_REPO, "status", "--porcelain")
    checks.append(check("fixture clean", dirty == "", "clean" if dirty == "" else "not verified/dirty"))

    # Effective publisher/private-install settings are protected in the live
    # service. This script MUST NOT infer them from old source or user input.
    checks.append(check("active publisher runtime-install disabled for fixture", False,
                        "requires authorized operator inspection of effective active config"))
    checks.append(check("active owner route binds typed test target", False,
                        "requires authorized operator proof from active service"))
    checks.append(check("admin approval to activate test target", False,
                        "explicit approval and safe rollback required"))

    print("FINAL:", "PASS" if all(checks) else "BLOCKED: do not dispatch a write job")
    return 0 if all(checks) else 2

if __name__ == "__main__":
    raise SystemExit(main())

[executed on device: v2202609413456515163 (31de8b2a-3ed2-4aee-8e34-ae3d88917ce4)]
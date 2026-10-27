#!/usr/bin/env python3
"""Administrator-only, read-only JARVIS routing inspection. Prints no credentials."""
import os, json, subprocess, hashlib, pathlib, re
def run(args):
    p = subprocess.run(args, capture_output=True, text=True, timeout=15)
    if p.returncode: return None
    return p.stdout.strip()
def main():
    if os.geteuid() != 0:
        print("BLOCKED: run in the existing authorized root console"); return 2
    report = {"schema":"jarvis.readonly-admin-routing-inspection.v1"}
    pid = run(["systemctl","show","jarvis-remote-operator.service","--property=MainPID","--value"])
    report["service"] = run(["systemctl","show","jarvis-remote-operator.service","-p","ActiveState","-p","User","-p","WorkingDirectory"])
    allowed = {
      "JARVIS_CLAUDE_REPO_DIR", "JARVIS_CLAUDE_BRIDGE_PROJECT", "JARVIS_BRIDGE_PROJECT",
      "JARVIS_OWNER_CHAT_AUTO_FINALIZE", "JARVIS_ACCEPTED_WORK_PUBLISHER_ENABLED",
      "JARVIS_PROJECT_MISSION_AURENTARA_REPO_DIR",
      "JARVIS_PROJECT_MISSION_AURENTARA_BRANCH",
      "JARVIS_OWNER_CHAT_PRIVATE_DEPLOY_ENABLED"
    }
    if pid and pid.isdigit() and int(pid)>0:
        env = pathlib.Path("/proc",pid,"environ").read_bytes().split(b"\0")
        values = dict(x.decode(errors="replace").split("=",1) for x in env if b"=" in x)
        report["selected_effective_env"] = {k:values.get(k,"UNSET") for k in sorted(allowed)}
    root = pathlib.Path("/opt/jarvis/chatgpt-test")
    files = ["src/jarvis/remote-operator-server-v1.js",
             "src/jarvis/owner-control-socket-v1.js",
             "src/jarvis/accepted-work-publisher-v1.js",
             "src/jarvis/project-target-registry-v1.js"]
    report["source"] = {}
    pattern = re.compile(r"owner_chat_private_deploy|owner_chat_push|ownerChatAutoFinalize|project.target|project_target|bridge_project|JARVIS_CLAUDE_REPO_DIR|validateRepoDir|startsWith|FORBIDDEN_BRANCHES|ALLOWED_KEYS")
    for rel in files:
        p=root/rel
        if not p.is_file(): continue
        raw=p.read_bytes()
        lines=raw.decode(errors="replace").splitlines()
        selected=[]
        for i,line in enumerate(lines,1):
            if pattern.search(line) and not re.search(r"secret|token|password|authorization",line,re.I):
                selected.append({"line":i,"text":line[:500]})
        report["source"][rel]={"sha256":hashlib.sha256(raw).hexdigest(),"routing_lines":selected}
    mount_json=run(["docker","inspect","--format","{{json .Mounts}}","jarvis-claude"])
    report["claude_mounts"]=json.loads(mount_json) if mount_json else "UNAVAILABLE"
    print(json.dumps(report,indent=2))
    return 0
if __name__=="__main__":
    raise SystemExit(main())

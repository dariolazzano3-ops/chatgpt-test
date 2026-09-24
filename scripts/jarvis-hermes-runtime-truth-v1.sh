#!/usr/bin/env bash
set -u
umask 077

echo "=== HERMES RUNTIME TRUTH V1 ==="
echo "USER=$(id -un)"
echo "UID=$(id -u)"
echo "HOST=$(hostname)"

echo
echo "=== PATH OWNERSHIP ==="
for p in /home/jarvis/.hermes /opt/data /opt/data/profiles /home/jarvis/claude-worker/workspace/hermes-rate-limit-resilience-v1; do
  if [[ -e "$p" ]]; then
    stat -c 'PATH=%n TYPE=%F OWNER=%U:%G MODE=%a UID=%u GID=%g' "$p" 2>/dev/null || true
  else
    echo "PATH=$p MISSING"
  fi
done

echo
echo "=== PORTS ==="
ss -ltn 2>/dev/null | awk 'NR==1 || /:8642|:8643/' || true

echo
echo "=== HERMES PROCESSES ==="
ps -eo pid,user,group,args --no-headers 2>/dev/null   | grep -Ei 'hermes|8642|8643'   | grep -Ev 'grep -E|runtime-truth-v1'   | sed -E 's/(api[_-]?key|token|secret|password|authorization)=[^ ]+/[REDACTED]/Ig'   | head -80 || true

echo
echo "=== SYSTEMD HERMES UNITS ==="
systemctl list-units --all --type=service --no-pager 2>/dev/null   | grep -Ei 'hermes|jarvis'   | head -80 || true

echo
echo "=== CONTAINER ACCESS ==="
if command -v docker >/dev/null 2>&1; then
  if docker ps --format 'NAME={{.Names}} IMAGE={{.Image}} STATUS={{.Status}} PORTS={{.Ports}}' >/tmp/hermes-docker-direct.$$ 2>/dev/null; then
    echo "DOCKER_DIRECT=YES"
    grep -Ei 'hermes|jarvis|8642|8643' /tmp/hermes-docker-direct.$$ || cat /tmp/hermes-docker-direct.$$
  else
    echo "DOCKER_DIRECT=NO"
  fi
  rm -f /tmp/hermes-docker-direct.$$ 2>/dev/null || true

  if sudo -n docker ps --format 'NAME={{.Names}} IMAGE={{.Image}} STATUS={{.Status}} PORTS={{.Ports}}' >/tmp/hermes-docker-sudo.$$ 2>/dev/null; then
    echo "DOCKER_SUDO_N=YES"
    grep -Ei 'hermes|jarvis|8642|8643' /tmp/hermes-docker-sudo.$$ || cat /tmp/hermes-docker-sudo.$$
  else
    echo "DOCKER_SUDO_N=NO"
  fi
  rm -f /tmp/hermes-docker-sudo.$$ 2>/dev/null || true
else
  echo "DOCKER_BINARY=NO"
fi

if command -v podman >/dev/null 2>&1; then
  echo "PODMAN_BINARY=YES"
  podman ps --format 'NAME={{.Names}} IMAGE={{.Image}} STATUS={{.Status}} PORTS={{.Ports}}' 2>/dev/null     | grep -Ei 'hermes|jarvis|8642|8643' || true
else
  echo "PODMAN_BINARY=NO"
fi

echo
echo "=== HISTORICAL HERMES ACTIVATORS ==="
find /tmp -maxdepth 1 -type f -name 'jarvis-*hermes*.sh' -printf '%M %u:%g %p\n' 2>/dev/null | sort || true

echo
echo "=== SAFE ACTIVATOR HINTS ==="
while IFS= read -r f; do
  [[ -r "$f" ]] || continue
  echo "--- $f ---"
  grep -nEi 'docker|podman|container|HERMES_HOME|/opt/data|8642|8643|systemctl|service' "$f" 2>/dev/null     | grep -Eiv 'key|token|secret|password|authorization|credential'     | head -80 || true
done < <(find /tmp -maxdepth 1 -type f -name 'jarvis-*hermes*.sh' 2>/dev/null | sort)

echo
echo "=== CURRENT HERMES CONFIG VISIBILITY ==="
if [[ -r /home/jarvis/.hermes/config.yaml ]]; then
  echo "HOST_HERMES_CONFIG_READABLE=YES"
  grep -nEi '^[[:space:]]*(memory:|provider:|memory_enabled:|user_profile_enabled:|platform_toolsets:|api_server:)' /home/jarvis/.hermes/config.yaml 2>/dev/null     | head -80 || true
else
  echo "HOST_HERMES_CONFIG_READABLE=NO"
fi

echo
echo "HERMES_RUNTIME_TRUTH_V1=PASS"

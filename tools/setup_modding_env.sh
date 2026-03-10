#!/usr/bin/env bash
set -euo pipefail

if ! command -v apt-get >/dev/null 2>&1; then
  echo "apt-get not found; install lua5.1, luarocks, libxml2-utils, shellcheck manually for your distro."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
sudo_cmd=""
if [[ "$(id -u)" -ne 0 ]]; then
  sudo_cmd="sudo"
fi

${sudo_cmd} apt-get update
${sudo_cmd} apt-get install -y --no-install-recommends \
  lua5.1 luarocks libxml2-utils shellcheck python3 python3-pip

# luacheck is the most useful static checker for Anomaly script mods.
if ! command -v luacheck >/dev/null 2>&1; then
  ${sudo_cmd} luarocks install luacheck
fi

echo "Installed core modding helpers: lua5.1, luacheck, xmllint, shellcheck."

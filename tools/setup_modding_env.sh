#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_BIN="$ROOT_DIR/tools/bin"

install_wrappers() {
  mkdir -p "$TOOLS_BIN"
  chmod +x "$TOOLS_BIN/xmllint" "$TOOLS_BIN/luacheck" 2>/dev/null || true
  echo "Installed/updated local offline wrappers in $TOOLS_BIN (luacheck, xmllint)."
}

if ! command -v apt-get >/dev/null 2>&1; then
  echo "apt-get not found; install lua5.1, luarocks, libxml2-utils, shellcheck manually for your distro."
  install_wrappers
  exit 0
fi

export DEBIAN_FRONTEND=noninteractive
sudo_cmd=""
if [[ "$(id -u)" -ne 0 ]]; then
  sudo_cmd="sudo"
fi

if ${sudo_cmd} apt-get update && ${sudo_cmd} apt-get install -y --no-install-recommends \
  lua5.1 luarocks libxml2-utils shellcheck python3 python3-pip; then
  if ! command -v luacheck >/dev/null 2>&1; then
    ${sudo_cmd} luarocks install luacheck || true
  fi
  echo "Installed core modding helpers: lua5.1, luacheck, xmllint, shellcheck."
else
  echo "apt/rocks installation failed (likely offline/proxy). Falling back to local wrappers."
fi

install_wrappers

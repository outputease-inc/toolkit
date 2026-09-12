#!/usr/bin/env sh
#
# OutputEase Toolkit installer
#
# Usage:
#   curl -fsSL https://toolkit.outputease.com/install.sh | sh
#   curl -fsSL https://toolkit.outputease.com/install.sh | sh -s -- --version 0.2.0
#
# Bootstraps bun if not already present, then installs @outputease/toolkit
# globally so the `outputease` binary lands on PATH.
#
# Supported: macOS, Linux, WSL, Git-Bash on Windows. Native Windows shells
# (cmd.exe, PowerShell) are not supported — use the install matrix in the
# package README instead.

set -eu

PKG="@outputease/toolkit"
VERSION="latest"

# Argument parsing: --version <x.y.z>
while [ $# -gt 0 ]; do
  case "$1" in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --version=*)
      VERSION="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

say() {
  printf "%s\n" "$*"
}

err() {
  printf "error: %s\n" "$*" >&2
}

require_curl() {
  if ! command -v curl >/dev/null 2>&1; then
    err "curl is required but not found on PATH"
    exit 1
  fi
}

ensure_bun() {
  if command -v bun >/dev/null 2>&1; then
    say "✓ bun already installed ($(bun --version))"
    return 0
  fi
  say "› bun not found; installing from https://bun.sh/install"
  curl -fsSL https://bun.sh/install | bash
  # Bun installs to $HOME/.bun/bin; add to PATH for this shell
  if [ -d "$HOME/.bun/bin" ]; then
    export PATH="$HOME/.bun/bin:$PATH"
  fi
  if ! command -v bun >/dev/null 2>&1; then
    err "bun install completed but 'bun' not on PATH. Open a new shell and re-run:"
    err "  bun add -g $PKG"
    exit 1
  fi
  say "✓ bun installed ($(bun --version))"
}

install_toolkit() {
  if [ "$VERSION" = "latest" ]; then
    say "› installing $PKG@latest globally"
    bun add -g "$PKG"
  else
    say "› installing $PKG@$VERSION globally"
    bun add -g "$PKG@$VERSION"
  fi
}

verify() {
  if ! command -v outputease >/dev/null 2>&1; then
    err "Install completed but 'outputease' not on PATH."
    err "Bun's global bin directory is usually at \$HOME/.bun/bin — make sure it's exported."
    err "  Add to your shell profile: export PATH=\"\$HOME/.bun/bin:\$PATH\""
    exit 1
  fi
  installed_version=$(outputease --version 2>/dev/null || echo "unknown")
  say ""
  say "✓ OutputEase Toolkit installed ($installed_version)"
  say ""
  say "Next: cd to your project directory, then run"
  say "  outputease init"
}

main() {
  require_curl
  ensure_bun
  install_toolkit
  verify
}

main

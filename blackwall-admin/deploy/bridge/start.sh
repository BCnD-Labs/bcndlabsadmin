#!/bin/sh
set -eu

if [ -z "${BRIDGE_KEY_PASSPHRASE:-}" ]; then
  echo 'Set BRIDGE_KEY_PASSPHRASE in the stack before starting Proton Bridge.' >&2
  exit 1
fi

# Named volume is root-owned on first use. Only the Bridge user reads its state.
if [ ! -d "$HOME" ] || [ "$(stat -c %u "$HOME")" != "$(id -u bridge)" ]; then
  mkdir -p "$HOME"
  chown -R bridge:bridge "$HOME"
fi
chmod 700 "$HOME"
exec gosu bridge /usr/local/bin/bridge-user "$@"

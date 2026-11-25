#!/bin/sh
set -eu
umask 077
mkdir -p "$GNUPGHOME" "$PASSWORD_STORE_DIR"
chmod 700 "$GNUPGHOME" "$PASSWORD_STORE_DIR"
printf 'allow-preset-passphrase\nmax-cache-ttl 315360000\n' > "$GNUPGHOME/gpg-agent.conf"
gpgconf --launch gpg-agent

if [ ! -f "$PASSWORD_STORE_DIR/.gpg-id" ]; then
  if ! gpg --batch --list-secret-keys --with-colons | grep -q '^sec:'; then
    printf '%s\n' "$BRIDGE_KEY_PASSPHRASE" | gpg --batch --pinentry-mode loopback --passphrase-fd 0 \
      --quick-generate-key 'Blackwall Bridge <bridge@local.invalid>' default default never
  fi
  fingerprint="$(gpg --batch --list-secret-keys --with-colons | awk -F: '$1 == "fpr" {print $10; exit}')"
  pass init "$fingerprint"
fi

# The GPG key is protected at rest. Seed the agent for unattended Bridge restarts.
keygrips="$(gpg --batch --with-keygrip --list-secret-keys --with-colons | awk -F: '$1 == "grp" {print $10}')"
if [ -z "$keygrips" ]; then echo 'Bridge GPG key was not found.' >&2; exit 1; fi
for keygrip in $keygrips; do
  printf '%s\n' "$BRIDGE_KEY_PASSPHRASE" | /usr/lib/gnupg/gpg-preset-passphrase --preset "$keygrip"
done
unset BRIDGE_KEY_PASSPHRASE

if [ ! -f "$HOME/.bridge-ready" ]; then
  echo 'First start: attach to this container, enter login and info in the Bridge CLI, then exit the CLI.'
  protonmail-bridge --cli
  touch "$HOME/.bridge-ready"
fi
exec "$@"

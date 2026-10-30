#!/bin/sh
# Restore a backup into the Blackwall database (replaces existing tables).
#   docker exec -it blackwall-backup-1 restore.sh /backups/blackwall-<timestamp>.dump.enc
# Encrypted (.enc) files need BACKUP_PASSPHRASE, which the container already has.
set -eu
file=${1:?usage: restore.sh /backups/blackwall-<timestamp>.dump[.enc]}
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
case "$file" in
  *.enc) openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$file" -out "$tmp" ;;
  *) cp "$file" "$tmp" ;;
esac
pg_restore --clean --if-exists --no-owner -d "$PGDATABASE" "$tmp"
echo "[restore] restored $(basename "$file"). Restart the app container to be safe."

#!/bin/sh
# Dumps the Blackwall database on a schedule, keeps local copies, and optionally
# uploads each one off-site with rclone. Writes /backups/last-status.json for the
# panel (Settings → Server & backups).
#   backup.sh        run forever, every BACKUP_INTERVAL_HOURS
#   backup.sh once   take one backup now (docker exec ... backup.sh once)
set -u

DIR=${BACKUP_DIR:-/backups}
KEEP_DAYS=${BACKUP_KEEP_DAYS:-14}
OFFSITE=${BACKUP_OFFSITE:-}
OFFSITE_KEEP=${BACKUP_OFFSITE_KEEP_DAYS:-60}
INTERVAL=$(( ${BACKUP_INTERVAL_HOURS:-24} * 3600 ))
mkdir -p "$DIR"

json_escape() { printf '%s' "$1" | tr '\n"\\' '   ' | cut -c1-300; }

status() { # ok file error offsite offsite_error
  now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  printf '{"at":"%s","ok":%s,"file":"%s","error":"%s","offsite":"%s","offsiteRemote":"%s","offsiteError":"%s"}\n' \
    "$now" "$1" "$2" "$(json_escape "$3")" "$4" "$OFFSITE" "$(json_escape "$5")" > "$DIR/last-status.json.tmp"
  mv "$DIR/last-status.json.tmp" "$DIR/last-status.json"
}

run_once() {
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  base="$DIR/blackwall-$ts.dump"
  if ! err=$(pg_dump -Fc -f "$base.tmp" 2>&1); then
    rm -f "$base.tmp"
    echo "[backup] dump failed: $err"
    status false "" "$err" off ""
    return 1
  fi

  if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
    openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$base.tmp" -out "$base.enc" && rm -f "$base.tmp"
    file="$base.enc"
  else
    mv "$base.tmp" "$base"
    file="$base"
  fi
  chmod 600 "$file"
  echo "[backup] wrote $(basename "$file") ($(wc -c < "$file") bytes)"

  # Local retention.
  find "$DIR" -name 'blackwall-*.dump*' -type f -mtime +"$KEEP_DAYS" -delete

  offsite=off; offsite_err=""
  if [ -n "$OFFSITE" ]; then
    if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
      offsite=failed; offsite_err="Set BACKUP_PASSPHRASE; unencrypted dumps are never uploaded."
    elif out=$(rclone copy "$file" "$OFFSITE" 2>&1); then
      offsite=ok
      rclone delete --min-age "${OFFSITE_KEEP}d" --include 'blackwall-*' "$OFFSITE" >/dev/null 2>&1 || true
    else
      offsite=failed; offsite_err="$out"
    fi
    echo "[backup] off-site: $offsite $offsite_err"
  fi
  status true "$(basename "$file")" "" "$offsite" "$offsite_err"
}

if [ "${1:-}" = "once" ]; then
  run_once
  exit $?
fi

echo "[backup] every ${BACKUP_INTERVAL_HOURS:-24}h; keeping ${KEEP_DAYS}d locally${OFFSITE:+, off-site to $OFFSITE (${OFFSITE_KEEP}d)}"
while true; do
  run_once || true
  sleep "$INTERVAL"
done

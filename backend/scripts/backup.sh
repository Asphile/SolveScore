#!/usr/bin/env bash
# Backs up the SQLite database (via sqlite3's .backup, which is safe to run
# against a live WAL-mode database) and the uploaded files, then deletes
# backups older than RETENTION_DAYS. Intended to run on the VPS via cron, e.g.:
#
#   0 3 * * * /path/to/backend/scripts/backup.sh >> /var/log/solvescore-backup.log 2>&1
#
# Restore: stop the app, then
#   cp backups/<timestamp>/solvescore.db backend/solvescore.db
#   tar -xzf backups/<timestamp>/uploads.tar.gz -C backend/

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="${BACKEND_DIR}/solvescore.db"
UPLOADS_DIR="${BACKEND_DIR}/uploads"
BACKUP_ROOT="${BACKEND_DIR}/backups"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

timestamp="$(date +%Y%m%d_%H%M%S)"
dest="${BACKUP_ROOT}/${timestamp}"
mkdir -p "$dest"

if [ -f "$DB_PATH" ]; then
  sqlite3 "$DB_PATH" ".backup '${dest}/solvescore.db'"
  echo "Backed up database to ${dest}/solvescore.db"
else
  echo "WARNING: no database found at ${DB_PATH}" >&2
fi

if [ -d "$UPLOADS_DIR" ]; then
  tar -czf "${dest}/uploads.tar.gz" -C "$BACKEND_DIR" uploads
  echo "Backed up uploads to ${dest}/uploads.tar.gz"
fi

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} +
echo "Pruned backups older than ${RETENTION_DAYS} days"

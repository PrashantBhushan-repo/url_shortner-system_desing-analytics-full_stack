#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/common.sh"
exec 9>/run/lock/pburls-deploy.lock
flock -w 900 9
previous=$(readlink -f /opt/pburls/current || true)
app_touched=false
backup_pending=''
had_runtime=false
if [[ -f $RUNTIME_ENV ]]; then cp -p "$RUNTIME_ENV" "$RUNTIME_ENV.previous"; had_runtime=true; fi
restore() {
  code=$?
  trap - ERR
  echo 'Deployment failed. Database migrations are not automatically reversed.'
  if [[ $backup_pending == /srv/pburls-data/migration-backups/*.partial ]]; then rm -f -- "$backup_pending"; fi
  if [[ $had_runtime == true ]]; then cp -p "$RUNTIME_ENV.previous" "$RUNTIME_ENV"; fi
  if [[ $app_touched == true && -n $previous && -f $previous/release.env ]]; then
    load_release "$previous"
    render_nginx https
    if wait_app; then
      dc exec -T frontend nginx -t && dc exec -T frontend nginx -s reload
      ln -sfn "$previous" /opt/pburls/current
      echo 'Previous application images restored.'
    else echo 'Rollback needs attention.'; fi
  fi
  exit "$code"
}
trap restore ERR
mv "$RUNTIME_ENV.pending" "$RUNTIME_ENV"
load_release "$1"
python3 "$RELEASE_DIR/infrastructure/scripts/settings.py" validate "$RUNTIME_ENV"
if [[ -z $DATA_VOLUME_ID ]]; then
  DATA_VOLUME_ID=$(aws ssm get-parameter --name "${PARAMETER_PREFIX:-/pburls/production}/data-volume-id" --query Parameter.Value --output text)
fi
export DATA_VOLUME_ID ALLOW_FORMAT_DATA_VOLUME
bash "$RELEASE_DIR/infrastructure/scripts/mount-data.sh"
require_data_disk
[[ $(df -Pk / | awk 'NR==2 {print $4}') -gt 3145728 ]] || { echo 'Less than 3 GiB free on the root disk.'; false; }
[[ $(df -Pk /srv/pburls-data | awk 'NR==2 {print $4}') -gt 2097152 ]] || { echo 'Less than 2 GiB free on the data disk.'; false; }
for folder in postgres redis certificates acme nginx migration-backups; do
  install -d -m 0750 "/srv/pburls-data/$folder"
done
chmod 0755 /srv/pburls-data/acme
if [[ ${OBSERVABILITY_ENABLED:-false} == true ]]; then
  bash "$RELEASE_DIR/infrastructure/scripts/observability.sh" --config-only
fi
dc config --quiet
dc pull backend worker frontend migrate certbot db redis
# Validate the actual image against production config before migrating anything.
dc run --rm --no-deps --entrypoint node backend -e 'await import("./src/config/config.js"); console.log("Production configuration valid")'
# Existing database/Redis containers are intentionally not recreated on app releases.
dc up -d --no-build --pull never --no-recreate --wait --wait-timeout 120 db redis
if [[ ${OBSERVABILITY_ENABLED:-false} == true ]]; then
  bash "$RELEASE_DIR/infrastructure/scripts/observability.sh"
fi
if [[ ${PRE_MIGRATION_BACKUP:-true} == true ]]; then
  database_bytes=$(dc exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_database_size(current_database())"')
  available_bytes=$(df -PB1 /srv/pburls-data | awk 'NR==2 {print $4}')
  [[ $database_bytes =~ ^[0-9]+$ && $available_bytes -gt $((database_bytes + 1073741824)) ]] || { echo 'Insufficient space for a safe local migration dump.'; false; }
  backup="/srv/pburls-data/migration-backups/pre-migration-$(date -u +%Y%m%dT%H%M%SZ).dump"
  backup_pending="$backup.partial"
  umask 077
  timeout 300s docker compose --project-name pburls --env-file "$RUNTIME_ENV" --env-file "$RELEASE_DIR/release.env" \
    -f "$RELEASE_DIR/infrastructure/compose.production.yml" exec -T db \
    sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_pending"
  [[ -s $backup_pending ]]
  mv "$backup_pending" "$backup"
  backup_pending=''
  # Local recovery aid only, not an independent backup. Keep the newest three dumps.
  python3 -c 'import pathlib; files=sorted(pathlib.Path("/srv/pburls-data/migration-backups").glob("pre-migration-*.dump")); [p.unlink() for p in files[:-3]]'
fi
dc run --rm --no-deps migrate
app_touched=true
dc up -d --no-build --pull never --no-deps --wait --wait-timeout 180 backend worker
if [[ -s /srv/pburls-data/certificates/live/$DOMAIN/fullchain.pem ]]; then render_nginx https; else render_nginx http-bootstrap; fi
dc up -d --no-build --pull never --no-deps --wait --wait-timeout 60 frontend
dc exec -T frontend nginx -t
dc exec -T frontend nginx -s reload
[[ $LETSENCRYPT_EMAIL == *@* ]] || { echo 'Set a valid LETSENCRYPT_EMAIL'; false; }
dc run --rm --no-deps certbot certonly --non-interactive --agree-tos --no-eff-email \
  --webroot --webroot-path /var/www/acme --cert-name "$DOMAIN" -d "$DOMAIN" \
  --email "$LETSENCRYPT_EMAIL" --keep-until-expiring
render_nginx https
dc exec -T frontend nginx -t
dc exec -T frontend nginx -s reload
wait_app
curl --fail --silent --show-error --retry 5 --retry-delay 2 --retry-all-errors \
  --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/plans" -o /dev/null
if [[ -n $previous && $previous != "$RELEASE_DIR" ]]; then ln -sfn "$previous" /opt/pburls/previous; fi
bash "$RELEASE_DIR/infrastructure/scripts/install-timers.sh"
ln -sfn "$RELEASE_DIR" /opt/pburls/current
rm -f "$RUNTIME_ENV.previous"
trap - ERR
echo 'Release deployed and HTTPS application checks passed.'

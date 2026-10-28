#!/usr/bin/env bash
set -Eeuo pipefail
export DOCKER_CONFIG=/etc/pburls/docker
export AWS_REGION=${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-southeast-2}}
export AWS_DEFAULT_REGION=$AWS_REGION
RUNTIME_ENV=/etc/pburls/runtime.env

load_release() {
  RELEASE_DIR=$(realpath "$1")
  [[ $RELEASE_DIR =~ ^/opt/pburls/releases/[0-9a-f]{40}-[0-9a-f]{12}$ ]] || { echo 'Invalid release directory'; return 1; }
  [[ -r $RUNTIME_ENV && -r $RELEASE_DIR/release.env ]] || { echo 'Runtime configuration or manifest missing'; return 1; }
  local exported_settings
  exported_settings=$(python3 "$RELEASE_DIR/infrastructure/scripts/settings.py" exports "$RUNTIME_ENV" DOMAIN LETSENCRYPT_EMAIL DATA_VOLUME_ID ALLOW_FORMAT_DATA_VOLUME PRE_MIGRATION_BACKUP APP_SUBNET OBSERVABILITY_ENABLED) || return $?
  eval "$exported_settings"
}

dc() {
  local extra=()
  if [[ ${OBSERVABILITY_ENABLED:-false} == true ]]; then
    extra=(-f "$RELEASE_DIR/infrastructure/observability/compose.production.yml")
  fi
  docker compose --project-name pburls --env-file "$RUNTIME_ENV" --env-file "$RELEASE_DIR/release.env" \
    -f "$RELEASE_DIR/infrastructure/compose.production.yml" "${extra[@]}" "$@"
}

require_data_disk() {
  mountpoint -q /srv/pburls-data || { echo 'Persistent data disk is not mounted. Refusing to start.'; return 1; }
}

render_nginx() {
  python3 "$RELEASE_DIR/infrastructure/scripts/settings.py" render "$RUNTIME_ENV" \
    "$RELEASE_DIR/infrastructure/nginx/$1.conf.template" /srv/pburls-data/nginx/default.conf
}

wait_app() { dc up -d --no-build --pull never --no-deps --wait --wait-timeout 180 backend worker frontend; }

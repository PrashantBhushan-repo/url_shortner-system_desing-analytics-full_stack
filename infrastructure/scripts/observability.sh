#!/usr/bin/env bash
set -Eeuo pipefail
# Called from deploy.sh after persistent database starts. No remote dashboards
# are changed here. Telemetry credentials stay on EC2, outside app containers.
source "$(dirname "$0")/common.sh"
load_release "$(dirname "$(dirname "$(dirname "$0")")")"
require_data_disk
if [[ ${1:-} == --config-only && -n ${PARAMETER_PREFIX:-} ]]; then
  umask 077
  aws ssm get-parameter --name "$PARAMETER_PREFIX/observability-env" --with-decryption \
    --query Parameter.Value --output text > /etc/pburls/observability.env.pending
  python3 "$RELEASE_DIR/infrastructure/observability/validate-env.py" /etc/pburls/observability.env.pending
  mv /etc/pburls/observability.env.pending /etc/pburls/observability.env
fi
python3 "$RELEASE_DIR/infrastructure/observability/validate-env.py" /etc/pburls/observability.env
chmod 600 /etc/pburls/observability.env
if [[ ${1:-} == --config-only ]]; then exit 0; fi
install -d -m 0750 /srv/pburls-data/alloy
dc pull alloy
dc run --rm --no-deps alloy validate /etc/alloy
dc run --rm --no-deps monitor-setup
dc up -d --no-build --pull never --no-deps alloy

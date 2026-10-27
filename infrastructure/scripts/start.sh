#!/usr/bin/env bash
set -Eeuo pipefail
source /opt/pburls/current/infrastructure/scripts/common.sh
load_release /opt/pburls/current
require_data_disk
dc up -d --no-build --pull never --no-recreate db redis backend worker frontend
if [[ ${OBSERVABILITY_ENABLED:-false} == true ]]; then dc up -d --no-build --pull never --no-recreate alloy; fi

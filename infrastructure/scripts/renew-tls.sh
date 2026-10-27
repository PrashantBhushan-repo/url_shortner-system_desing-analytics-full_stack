#!/usr/bin/env bash
set -Eeuo pipefail
source /opt/pburls/current/infrastructure/scripts/common.sh
exec 9>/run/lock/pburls-deploy.lock
flock -w 900 9
load_release /opt/pburls/current
require_data_disk
dc run --rm --no-deps certbot renew --non-interactive --webroot --webroot-path /var/www/acme
dc exec -T frontend nginx -t
dc exec -T frontend nginx -s reload

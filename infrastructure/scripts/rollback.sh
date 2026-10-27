#!/usr/bin/env bash
set -Eeuo pipefail
source /opt/pburls/current/infrastructure/scripts/common.sh
exec 9>/run/lock/pburls-deploy.lock
flock -w 900 9
old=$(readlink -f /opt/pburls/previous)
current=$(readlink -f /opt/pburls/current)
[[ -n $old && $old != "$current" ]] || { echo 'No previous release available'; exit 1; }
load_release "$old"
require_data_disk
render_nginx https
wait_app
dc exec -T frontend nginx -t
dc exec -T frontend nginx -s reload
ln -sfn "$current" /opt/pburls/previous
ln -sfn "$old" /opt/pburls/current
echo 'Previous application release restored. Database and runtime secrets unchanged.'

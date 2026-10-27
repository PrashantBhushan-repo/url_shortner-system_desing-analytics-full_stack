#!/usr/bin/env bash
set -Eeuo pipefail
cat > /etc/systemd/system/pburls.service <<'EOF'
[Unit]
Description=PBUrls containers
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target
RequiresMountsFor=/srv/pburls-data
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash /opt/pburls/current/infrastructure/scripts/start.sh
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/pburls-renew.service <<'EOF'
[Unit]
Description=Renew PBUrls HTTPS certificate
Requires=docker.service
After=docker.service
RequiresMountsFor=/srv/pburls-data
[Service]
Type=oneshot
ExecStart=/bin/bash /opt/pburls/current/infrastructure/scripts/renew-tls.sh
EOF
cat > /etc/systemd/system/pburls-renew.timer <<'EOF'
[Unit]
Description=Check PBUrls certificate twice daily
[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable pburls.service
systemctl enable --now pburls-renew.timer

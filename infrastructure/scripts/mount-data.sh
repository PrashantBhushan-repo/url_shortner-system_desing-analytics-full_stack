#!/usr/bin/env bash
set -Eeuo pipefail
[[ ${DATA_VOLUME_ID:-} =~ ^vol-[0-9a-f]+$ ]] || { echo 'Set DATA_VOLUME_ID to the separate EBS data volume.'; exit 1; }
serial=${DATA_VOLUME_ID//-/}
device=''
for attempt in {1..60}; do
  device=$(lsblk -dnpo NAME,SERIAL | awk -v id="$serial" '$2 == id {print $1}')
  [[ -n $device ]] && break
  sleep 2
done
[[ -b $device ]] || { echo 'Cannot identify the data disk by EBS volume ID.'; exit 1; }
root_source=$(findmnt -no SOURCE /)
if lsblk -snrpo NAME "$root_source" | grep -Fxq "$device"; then
  echo 'Refusing to use the operating system disk.'; exit 1
fi
if mountpoint -q /srv/pburls-data; then
  [[ $(findmnt -no UUID /srv/pburls-data) == "$(blkid -s UUID -o value "$device")" ]] || { echo 'Unexpected data disk mounted'; exit 1; }
  exit 0
fi
filesystem=$(blkid -s TYPE -o value "$device" || true)
if [[ -z $filesystem ]]; then
  [[ ${ALLOW_FORMAT_DATA_VOLUME:-false} == true ]] || { echo 'New blank disk: set ALLOW_FORMAT_DATA_VOLUME=true for first setup only.'; exit 1; }
  [[ -z $(wipefs -n "$device") ]] || { echo 'Disk signatures found; refusing to format.'; exit 1; }
  [[ $(lsblk -nrpo NAME "$device" | wc -l) -eq 1 ]] || { echo 'Partitioned disk; refusing to format.'; exit 1; }
  mkfs.ext4 -L pburls-data "$device"
elif [[ $filesystem != ext4 ]]; then
  echo 'Expected an ext4 data volume; refusing to modify it.'; exit 1
fi
uuid=$(blkid -s UUID -o value "$device")
install -d -m 0750 /srv/pburls-data
if ! grep -Fq "UUID=$uuid " /etc/fstab; then
  ! grep -Eq '^[^#].* /srv/pburls-data ' /etc/fstab || { echo 'Conflicting fstab mount'; exit 1; }
  echo "UUID=$uuid /srv/pburls-data ext4 defaults,nofail,x-systemd.device-timeout=60s 0 2" >> /etc/fstab
fi
mount /srv/pburls-data
install -d -m 0755 /etc/systemd/system/docker.service.d
printf '[Unit]\nRequiresMountsFor=/srv/pburls-data\n' > /etc/systemd/system/docker.service.d/pburls-storage.conf
systemctl daemon-reload

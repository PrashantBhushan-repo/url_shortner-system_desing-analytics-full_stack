#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run as root (SSM runs as root).'; exit 1; }
export DEBIAN_FRONTEND=noninteractive
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  . /etc/os-release
  [[ $ID == ubuntu && $VERSION_ID == 24.04 ]] || { echo 'Bootstrap supports Ubuntu 24.04 x86_64.'; exit 1; }
  [[ $(uname -m) == x86_64 ]] || exit 1
  apt-get update -qq
  apt-get install -y ca-certificates curl unzip python3 util-linux e2fsprogs
  install -m 0755 -d /etc/apt/keyrings
  curl --fail --silent --show-error https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo 'deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable' > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
if ! command -v aws >/dev/null; then
  command -v unzip >/dev/null || { apt-get update -qq; apt-get install -y unzip curl; }
  work=$(mktemp -d /tmp/pburls-awscli.XXXXXX)
  curl --fail --silent --show-error https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o "$work/aws.zip"
  unzip -q "$work/aws.zip" -d "$work"
  "$work/aws/install" --update
  # Only the freshly-created installer directory is removed.
  [[ $work == /tmp/pburls-awscli.* ]] && rm -rf -- "$work"
fi
command -v python3 >/dev/null
install -d -m 0700 /etc/pburls /etc/pburls/docker
install -d -m 0750 /opt/pburls/releases
systemctl enable --now docker

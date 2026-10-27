#!/usr/bin/env bash
# Run on your workstation or AWS CloudShell, never on the production instance.
set -Eeuo pipefail
command -v gh >/dev/null || { echo 'Install GitHub CLI and run gh auth login first.'; exit 1; }
repo=${1:?Usage: configure-github.sh owner/repository}
[[ $repo =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || exit 1
export AWS_REGION=${AWS_REGION:-us-east-1}
[[ $AWS_REGION == us-east-1 ]] || { echo 'This project deploys to us-east-1. Set AWS_REGION=us-east-1.'; exit 1; }
: "${EC2_INSTANCE_ID:?Set EC2_INSTANCE_ID}"
: "${AWS_DEPLOY_ROLE_ARN:?Set AWS_DEPLOY_ROLE_ARN from CloudFormation outputs}"
: "${GHCR_PULL_USERNAME:?Set GHCR_PULL_USERNAME to the read-only package token owner}"
settings=$(mktemp /tmp/pburls-github.XXXXXX)
trap 'rm -f -- "$settings"' EXIT
printf '%s\n' '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' > "$settings"
gh api --method PUT "repos/$repo/environments/production" --input "$settings" >/dev/null
existing=$(gh api "repos/$repo/environments/production/deployment-branch-policies" --jq '.branch_policies[] | select(.name == "main" and .type == "branch") | .id')
if [[ -z $existing ]]; then
  gh api --method POST "repos/$repo/environments/production/deployment-branch-policies" -f name=main -f type=branch >/dev/null
fi
for key in AWS_REGION EC2_INSTANCE_ID AWS_DEPLOY_ROLE_ARN GHCR_PULL_USERNAME; do
  gh variable set "$key" --repo "$repo" --body "${!key}"
done
gh variable set PARAMETER_PREFIX --repo "$repo" --body "${PARAMETER_PREFIX:-/pburls/production}"
# Deliberately disabled until DNS and Parameter Store are ready.
gh variable set PROD_DEPLOY_ENABLED --repo "$repo" --body "${PROD_DEPLOY_ENABLED:-false}"
echo 'Production environment restricted to main; deployment variables configured.'

#!/usr/bin/env python3
"""Dispatch a digest-pinned deployment over SSM; the GitHub runner holds no app secrets."""
import argparse
import json
import os
import pathlib
import re
import shlex
import subprocess
import time


def region():
    value = os.environ.get('AWS_REGION') or os.environ.get('AWS_DEFAULT_REGION') or 'ap-southeast-2'
    if not re.fullmatch(r'[a-z]{2}(?:-[a-z]+)+-[0-9]+', value):
        raise ValueError('Invalid AWS region')
    return value


def aws(*args):
    return json.loads(subprocess.check_output(['aws', *args, '--region', region(), '--output', 'json'], text=True))


def check_configuration(rollback=False):
    instance = os.environ.get('EC2_INSTANCE_ID', '').strip()
    if not re.fullmatch(r'i-(?:[0-9a-f]{8}|[0-9a-f]{17})', instance):
        raise ValueError('Missing or invalid EC2_INSTANCE_ID. In GitHub repository Settings > Secrets and variables > Actions > Variables, '
                         'set repository VARIABLE EC2_INSTANCE_ID to the AWS instance ID (i- followed by 8 or 17 hexadecimal characters), '
                         'not an ARN, IP address or secret. Check production-environment variables for a conflicting override.')
    region()
    if not rollback:
        username = os.environ.get('GHCR_PULL_USERNAME', '').strip()
        if not re.fullmatch(r'[A-Za-z0-9-]+', username):
            raise ValueError('Set GitHub repository variable GHCR_PULL_USERNAME to the owner of the EC2 read-only package token.')
        prefix = os.environ.get('PARAMETER_PREFIX') or '/pburls/production'
        if not re.fullmatch(r'/[A-Za-z0-9_./-]+', prefix) or '..' in prefix:
            raise ValueError('Set PARAMETER_PREFIX to a valid Parameter Store path, for example /pburls/production.')
    return instance


def deployment_commands(image, sha, username, prefix):
    if not re.fullmatch(r'ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}', image):
        raise ValueError('Use a GHCR deployment image pinned by digest')
    if not re.fullmatch(r'[a-f0-9]{40}', sha):
        raise ValueError('Invalid release SHA')
    if not re.fullmatch(r'[A-Za-z0-9-]+', username):
        raise ValueError('Invalid registry username')
    if not re.fullmatch(r'/[A-Za-z0-9_./-]+', prefix) or '..' in prefix:
        raise ValueError('Invalid Parameter Store prefix')
    q = shlex.quote
    release_id = sha + '-' + image.rsplit(':', 1)[1][:12]
    install = pathlib.Path(__file__).with_name('install-host.sh').read_text()
    commands = f'''set -Eeuo pipefail
umask 077
export DOCKER_CONFIG=/etc/pburls/docker
export AWS_REGION={q(region())} AWS_DEFAULT_REGION={q(region())}
export PARAMETER_PREFIX={q(prefix)}
aws ssm get-parameter --name {q(prefix + '/runtime-env')} --with-decryption --query Parameter.Value --output text > /etc/pburls/runtime.env.pending
chmod 600 /etc/pburls/runtime.env.pending
aws ssm get-parameter --name {q(prefix + '/ghcr-token')} --with-decryption --query Parameter.Value --output text | docker login ghcr.io -u {q(username)} --password-stdin
docker pull {q(image)}
release=/opt/pburls/releases/{release_id}
container=pburls-bundle-{release_id}
if docker container inspect "$container" >/dev/null 2>&1; then docker rm "$container"; fi
docker create --name "$container" {q(image)}
install -d -m 0750 "$release"
docker cp "$container:/bundle/." "$release/"
docker rm "$container"
bash "$release/infrastructure/scripts/deploy.sh" "$release"
'''
    # SSM's default shell is /bin/sh; explicitly execute Bash for each script.
    return ['bash -c ' + q(install), 'bash -c ' + q(commands)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--image')
    parser.add_argument('--sha')
    parser.add_argument('--rollback', action='store_true')
    parser.add_argument('--check-config', action='store_true', help='Validate GitHub deployment variables without AWS calls')
    args = parser.parse_args()
    instance = check_configuration(rollback=args.rollback)
    if args.check_config:
        print(f'Deployment variables valid: EC2 target {instance}, region {region()}. No AWS calls made.')
        return
    commands = [f'AWS_REGION={shlex.quote(region())} AWS_DEFAULT_REGION={shlex.quote(region())} bash /opt/pburls/current/infrastructure/scripts/rollback.sh'] if args.rollback else deployment_commands(
        args.image or '', args.sha or '', os.environ['GHCR_PULL_USERNAME'].strip(), os.environ.get('PARAMETER_PREFIX') or '/pburls/production')
    sent = aws('ssm', 'send-command', '--instance-ids', instance, '--document-name', 'AWS-RunShellScript',
               '--parameters', json.dumps({'commands': commands, 'executionTimeout': ['1800']}), '--timeout-seconds', '600',
               '--comment', 'PBUrls GitHub deployment' if not args.rollback else 'PBUrls application rollback')
    command = sent['Command']['CommandId']
    print(f'SSM command submitted: {command}', flush=True)
    deadline = time.monotonic() + 1900
    while time.monotonic() < deadline:
        try:
            result = aws('ssm', 'get-command-invocation', '--command-id', command, '--instance-id', instance)
        except subprocess.CalledProcessError:
            time.sleep(5)
            continue
        status = result['Status']
        if status not in ['Pending', 'InProgress', 'Delayed']:
            print(result.get('StandardOutputContent', ''))
            print(result.get('StandardErrorContent', ''))
            if status != 'Success':
                raise RuntimeError(f'SSM deployment finished with {status}')
            return
        time.sleep(15)
    raise TimeoutError('SSM deployment timed out; inspect command status before retrying')


if __name__ == '__main__':
    main()

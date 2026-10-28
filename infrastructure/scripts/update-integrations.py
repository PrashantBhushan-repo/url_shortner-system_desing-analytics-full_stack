#!/usr/bin/env python3
"""Merge an uploaded private integration patch into an existing SSM runtime env."""
import argparse
import json
import os
import pathlib
import re
import subprocess
import tempfile

PROVIDERS = ('GOOGLE', 'GITHUB', 'AMAZON', 'MICROSOFT')
ALLOWED = {'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET',
           'RAZORPAY_PREVIOUS_WEBHOOK_SECRET', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE',
           'SMTP_USER', 'SMTP_PASS', 'FROM_EMAIL', 'BYPASS_EMAIL_ERROR'} | {
    p + '_' + suffix for p in PROVIDERS for suffix in ('CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI')}


def merge(original, patch, domain):
    if not patch or set(patch) - ALLOWED:
        raise ValueError('Patch contains unsupported settings; database/JWT/storage changes are forbidden.')
    for key, value in patch.items():
        if not isinstance(value, str) or any(c in value for c in "\r\n'"):
            raise ValueError(f'{key} requires a single-line value without single quotes.')
    if not patch.get('RAZORPAY_KEY_ID', '').startswith('rzp_test_') or not patch.get('RAZORPAY_KEY_SECRET'):
        raise ValueError('This update requires Razorpay TEST mode credentials.')
    if patch.get('BYPASS_EMAIL_ERROR') != 'false':
        raise ValueError('Email error bypass must remain false in production.')
    for key in ('SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'FROM_EMAIL'):
        if not patch.get(key):
            raise ValueError(f'Missing SMTP configuration: {key}')
    if not patch['SMTP_PORT'].isdigit() or not 1 <= int(patch['SMTP_PORT']) <= 65535:
        raise ValueError('Invalid SMTP_PORT')
    if patch.get('SMTP_SECURE') not in ('true', 'false'):
        raise ValueError('Invalid SMTP_SECURE')
    for provider in PROVIDERS:
        keys = [provider + '_' + s for s in ('CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI')]
        if any(k in patch for k in keys):
            if not all(patch.get(k) for k in keys):
                raise ValueError(f'{provider} configuration is incomplete.')
            if patch[keys[2]] != f'https://{domain}/api/auth/oauth/{provider.lower()}/callback':
                raise ValueError(f'{provider} callback must use the production HTTPS hostname.')
    values, retained = {}, []
    for number, line in enumerate(original.splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            retained.append(line)
            continue
        match = re.fullmatch(r'(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)', stripped)
        if not match:
            raise ValueError(f'Existing runtime file has an unsupported line: {number}')
        key, value = match.groups()
        if key in values:
            raise ValueError(f'Existing runtime file has duplicate setting: {key}')
        values[key] = value
        if key not in patch:
            retained.append(line)
    def scalar(key):
        raw = values.get(key, '')
        if raw.startswith('"'):
            return json.loads(raw)
        if raw.startswith("'") and raw.endswith("'"):
            return raw[1:-1]
        return raw.split(' #', 1)[0].rstrip()
    if scalar('NODE_ENV') != 'production' or scalar('DOMAIN') != domain:
        raise ValueError('Existing runtime parameter does not match the production domain/environment.')
    # Single quotes preserve literal $, #, quotes and backslashes in Compose env files.
    appended = [f"{key}='{value}'" for key, value in patch.items()]
    return '\n'.join(retained).rstrip() + '\n\n# Production integrations (Razorpay TEST mode)\n' + '\n'.join(appended) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--patch', required=True)
    parser.add_argument('--account', required=True)
    parser.add_argument('--region', default='ap-southeast-2')
    parser.add_argument('--parameter', default='/pburls/production/runtime-env')
    parser.add_argument('--domain', default='pburls.online')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'\d{12}', args.account) or not re.fullmatch(r'[a-z]{2}(?:-[a-z]+)+-\d+', args.region):
        raise ValueError('Invalid account or region.')
    if not re.fullmatch(r'/[A-Za-z0-9_./-]+', args.parameter) or '..' in args.parameter:
        raise ValueError('Invalid parameter name.')
    if not re.fullmatch(r'(?:[a-z0-9-]+\.)+[a-z]{2,63}', args.domain):
        raise ValueError('Invalid production domain.')
    def aws(*command):
        result = subprocess.run(['aws', *command, '--region', args.region, '--output', 'json'],
                                capture_output=True, text=True, timeout=60)
        if result.returncode:
            raise RuntimeError(f'AWS {command[0]} {command[1]} failed; check account permissions, region and existing parameter. No secret output displayed.')
        return json.loads(result.stdout)
    if aws('sts', 'get-caller-identity').get('Account') != args.account:
        raise ValueError('Wrong AWS account: no parameter was changed.')
    patch = json.loads(pathlib.Path(args.patch).read_text(encoding='utf-8-sig'))
    current = aws('ssm', 'get-parameter', '--name', args.parameter, '--with-decryption')['Parameter']
    if current.get('Type') != 'SecureString':
        raise ValueError('Existing runtime parameter must be SecureString.')
    merged = merge(current['Value'], patch, args.domain)
    metadata = aws('ssm', 'describe-parameters', '--parameter-filters',
                   f'Key=Name,Option=Equals,Values={args.parameter}').get('Parameters', [])
    if len(metadata) != 1 or metadata[0].get('Name') != args.parameter or not metadata[0].get('KeyId'):
        raise ValueError('Cannot verify existing encryption key/tier; no parameter was changed.')
    tier = metadata[0].get('Tier', 'Standard')
    limit = {'Standard': 4096, 'Advanced': 8192}.get(tier)
    if not limit or len(merged.encode('utf-8')) > limit:
        raise ValueError('Merged value exceeds the existing parameter tier. No automatic tier or billing change was made.')
    if args.dry_run:
        print(f'Dry run passed: {len(patch)} integration settings, test payments, production callbacks. No AWS changes made.')
        return
    if aws('ssm', 'get-parameter', '--name', args.parameter)['Parameter']['Version'] != current['Version']:
        raise ValueError('Runtime parameter changed during preparation. Retry using its latest version.')
    request = {'Name': args.parameter, 'Type': 'SecureString', 'Value': merged, 'Overwrite': True,
               'KeyId': metadata[0]['KeyId'], 'Tier': tier}
    with tempfile.TemporaryDirectory(prefix='pburls-ssm-integrations-') as directory:
        target = pathlib.Path(directory) / 'request.json'
        descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, 'w', encoding='utf-8') as output:
            json.dump(request, output)
        response = aws('ssm', 'put-parameter', '--cli-input-json', 'file://' + str(target))
    verified = aws('ssm', 'get-parameter', '--name', args.parameter, '--with-decryption')['Parameter']
    if verified['Value'] != merged:
        raise RuntimeError('Parameter readback differs; inspect concurrent updates before deploying.')
    print(f'Updated {args.parameter} in {args.region}; version {response["Version"]}.')
    print('Verified: Razorpay TEST mode, production OAuth callbacks and SMTP. Database/JWT/storage values preserved. No application deployment or payment/email requests performed.')


if __name__ == '__main__':
    try:
        main()
    except (json.JSONDecodeError, OSError, subprocess.TimeoutExpired):
        # Do not display raw JSON parsing context, request payloads or subprocess output.
        import sys
        print('Integration update failed. Check AWS account/region/permissions, patch format and the existing production runtime settings. No secret output displayed.', file=sys.stderr)
        sys.exit(1)
    except (ValueError, RuntimeError) as error:
        import sys
        print(str(error), file=sys.stderr)
        sys.exit(1)

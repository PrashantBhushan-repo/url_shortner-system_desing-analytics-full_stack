#!/usr/bin/env python3
"""Read single-line dotenv settings without executing shell code or printing secrets."""
import argparse
import json
import pathlib
import re
import shlex
from urllib.parse import urlsplit


def read_env(filename):
    settings = {}
    for number, line in enumerate(pathlib.Path(filename).read_text().splitlines(), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[7:]
        key, sep, value = line.partition('=')
        key, value = key.strip(), value.strip()
        if not sep or not re.fullmatch(r'[A-Z][A-Z0-9_]*', key):
            raise ValueError(f'Invalid setting name on line {number}')
        if value.startswith('"'):
            value = json.loads(value)
        elif value.startswith("'"):
            if not value.endswith("'"):
                raise ValueError(f'Unclosed quote on line {number}')
            value = value[1:-1]
        else:
            value = value.split(' #', 1)[0].rstrip()
        if not isinstance(value, str) or '\n' in value or '\r' in value:
            raise ValueError(f'Use single-line values for {key}')
        if key in settings:
            raise ValueError(f'Duplicate setting: {key}')
        settings[key] = value
    return settings


def domain_name(value):
    if len(value) > 253 or not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}', value):
        raise ValueError('DOMAIN must be a lowercase DNS hostname, without scheme, port, or path')
    return value


def validate_runtime(values):
    if values.get('OBSERVABILITY_ENABLED', 'false') not in ('true', 'false'):
        raise ValueError('OBSERVABILITY_ENABLED must be true or false')
    domain = domain_name(values.get('DOMAIN', ''))
    for key in ['BASE_URL', 'CLIENT_URL']:
        url = urlsplit(values.get(key, ''))
        if url.scheme != 'https' or url.netloc != domain or url.path not in ['', '/'] or url.query or url.fragment:
            raise ValueError(f'{key} must match the canonical HTTPS DOMAIN')
    if not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', values.get('LETSENCRYPT_EMAIL', '')):
        raise ValueError('Set a valid LETSENCRYPT_EMAIL')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['exports', 'render', 'validate'])
    parser.add_argument('env_file')
    parser.add_argument('values', nargs='*')
    args = parser.parse_args()
    values = read_env(args.env_file)
    if args.action == 'validate':
        validate_runtime(values)
        print('Canonical HTTPS and certificate settings valid; no secrets displayed.')
    elif args.action == 'exports':
        allowed = {'DOMAIN', 'LETSENCRYPT_EMAIL', 'DATA_VOLUME_ID', 'ALLOW_FORMAT_DATA_VOLUME', 'PRE_MIGRATION_BACKUP', 'APP_SUBNET', 'OBSERVABILITY_ENABLED'}
        # Validate the complete request before emitting any shell assignments.
        if any(key not in allowed for key in args.values):
            raise ValueError('Unsupported exported setting')
        for key in args.values:
            print(f'export {key}={shlex.quote(values.get(key, ""))}')
    else:
        template, output = map(pathlib.Path, args.values)
        content = template.read_text().replace('__DOMAIN__', domain_name(values.get('DOMAIN', '')))
        # Write in place: a bind-mounted Nginx config must retain its inode.
        output.write_text(content)


if __name__ == '__main__':
    main()

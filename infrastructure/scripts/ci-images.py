#!/usr/bin/env python3
"""Resolve exact private source-matched images, or request builds. No app secrets."""
import argparse
import hashlib
import json
import os
import re
import subprocess
import urllib.error
import urllib.request

KINDS = ('backend', 'migration', 'frontend', 'ops')
DIGEST = re.compile(r'sha256:[a-f0-9]{64}')


def namespace(repository):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
        raise ValueError('Invalid GitHub repository')
    owner, name = repository.lower().split('/')
    return owner, name + '-private', f'ghcr.io/{owner}/{name}-private'


def fingerprint(kind):
    context = 'frontend' if kind == 'frontend' else 'backend'
    # Include build policy as well as source. Never hash private/untracked env files.
    inputs = [kind, 'linux/amd64;VITE_API_URL=/api;recipe-v1']
    for path in (context, '.node-version', '.github/workflows/ci-cd.yml', 'infrastructure/scripts/ci-images.py'):
        inputs.append(subprocess.check_output(['git', 'rev-parse', f'HEAD:{path}'], text=True).strip())
    return hashlib.sha256('\n'.join(inputs).encode()).hexdigest()


class Registry:
    def __init__(self, repository):
        self.repository = repository
        self.owner, self.name, self.prefix = namespace(repository)

    def api(self, path):
        token = os.environ.get('GH_TOKEN', '')
        if not token:
            raise ValueError('GH_TOKEN is required for private registry access')
        request = urllib.request.Request('https://api.github.com/' + path, headers={
            'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'pburls-ci'})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            raise RuntimeError(f'GitHub registry API returned HTTP {error.code}; refusing to publish') from None

    def verify(self, allow_missing):
        repo = self.api('repos/' + self.repository)
        if not repo:
            raise ValueError('Cannot inspect repository owner for registry privacy checks')
        owner_type = repo.get('owner', {}).get('type')
        if owner_type not in ('User', 'Organization'):
            raise ValueError('Unsupported registry owner type')
        route = 'orgs' if owner_type == 'Organization' else 'users'
        for kind in KINDS:
            package = self.api(f'{route}/{self.owner}/packages/container/{self.name}-{kind}')
            if package is None and allow_missing:
                continue
            if not package or package.get('visibility') != 'private':
                raise ValueError(f'Package {self.name}-{kind} must be private; do not reuse a public namespace')


def inspect_digest(tag):
    result = subprocess.run(['docker', 'buildx', 'imagetools', 'inspect', tag, '--format', '{{json .Manifest}}'],
                            capture_output=True, text=True, timeout=60)
    if result.returncode:
        # A missing source tag is a cache miss. Auth/network/other errors are not.
        if re.search(r'manifest unknown|not found|\b404\b', result.stderr, re.I):
            return None
        raise RuntimeError('Cannot inspect private source image; check registry authentication/connectivity')
    manifest = json.loads(result.stdout)
    digest = manifest.get('digest', '')
    if not DIGEST.fullmatch(digest):
        raise ValueError('Registry returned an invalid manifest digest')
    return digest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['plan', 'verify'])
    args = parser.parse_args()
    registry = Registry(os.environ['GITHUB_REPOSITORY'])
    publish = os.environ.get('PUBLISH_IMAGES') == 'true'
    if args.mode == 'verify':
        registry.verify(allow_missing=False)
        print('All release packages are private.')
        return
    if publish:
        registry.verify(allow_missing=True)
    outputs = dict(prefix=registry.prefix)
    refresh = os.environ.get('REFRESH_IMAGES') == 'true'
    for kind in KINDS[:-1]:
        tag = f'{registry.prefix}-{kind}:source-{fingerprint(kind)}'
        digest = inspect_digest(tag) if publish and not refresh else None
        outputs.update({kind + '_source_tag': tag, kind + '_digest': digest or '', kind + '_build': str(digest is None).lower()})
        print(f'{kind}: {"reuse verified private digest" if digest else "build source image"}')
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        for key, value in outputs.items():
            output.write(f'{key}={value}\n')


if __name__ == '__main__':
    main()

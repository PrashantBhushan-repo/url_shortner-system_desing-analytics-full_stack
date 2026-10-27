#!/usr/bin/env python3
"""Plan CI from complete Git diffs and the last successful GitHub push run."""
import argparse
import json
import os
import pathlib
import re
import subprocess
import urllib.error
import urllib.request


def successful_base(repository, token):
    if not token or not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
        return None
    url = f'https://api.github.com/repos/{repository}/actions/workflows/ci-cd.yml/runs?branch=main&event=push&status=success&per_page=1'
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json', 'User-Agent': 'pburls-ci'})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            runs = json.load(response).get('workflow_runs', [])
    except (urllib.error.URLError, TimeoutError, ValueError):
        print('Cannot verify a previous green pipeline; selecting full checks.')
        return None
    sha = runs[0].get('head_sha', '') if runs else ''
    return sha if re.fullmatch(r'[a-f0-9]{40,64}', sha) else None


def classify(paths, force=False):
    result = dict(backend=force, frontend=force, infrastructure=force, release=force, refresh=force)
    for path in paths:
        # Only known documentation locations may skip executable checks.
        if path in ('README.md', 'ENVIRONMENT.md', 'LICENSE', 'LICENSE.md') or path.startswith(('docs/', 'system_desing_dsa/', 'image/')):
            continue
        if path.startswith('infrastructure/') and path.endswith('.md'):
            continue
        if path.startswith('backend/'):
            # The frontend Socket.IO regression also imports the backend dependency.
            result.update(backend=True, frontend=True, release=True)
        elif path.startswith('frontend/'):
            result.update(frontend=True, release=True)
        elif path.startswith('infrastructure/'):
            result.update(infrastructure=True, release=True)
        else:
            # Workflows, shared versions, Compose, unknown files: fail safe to full CI.
            result.update(backend=True, frontend=True, infrastructure=True, release=True)
    return result


def changed_paths(event, payload, head):
    if event in ('schedule', 'workflow_dispatch'):
        return [], True
    base = payload.get('pull_request', {}).get('base', {}).get('sha') if event == 'pull_request' else payload.get('before')
    if not base or not re.fullmatch(r'[a-f0-9]{40,64}', base) or set(base) == {'0'}:
        return [], True
    try:
        # No rename detection: both sides of moves are considered. -z preserves spaces.
        files = subprocess.check_output(['git', 'diff', '--no-renames', '--name-only', '-z', base, head, '--'])
    except subprocess.CalledProcessError:
        return [], True
    return [p.decode('utf-8', errors='surrogateescape') for p in files.split(b'\0') if p], False


def check_gate(needs):
    if needs.get('changes', {}).get('result') != 'success':
        raise ValueError('Change planning did not succeed')
    plan = needs['changes']['outputs']
    for job, flag in [('backend', 'backend'), ('frontend', 'frontend'), ('infrastructure', 'infrastructure'), ('build', 'release')]:
        if plan.get(flag) not in ('true', 'false'):
            raise ValueError(f'Missing or invalid plan output: {flag}')
        expected = 'success' if plan.get(flag) == 'true' else 'skipped'
        if needs.get(job, {}).get('result') != expected:
            raise ValueError(f'Required job {job} did not finish as {expected}')


def deployment_allowed(head, latest, paths):
    if not re.fullmatch(r'[a-f0-9]{40,64}', latest):
        raise ValueError('Cannot verify current main revision')
    # Documentation cannot supersede an otherwise verified runtime release.
    return head == latest or not classify(paths)['release']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['plan', 'gate', 'deploy'])
    args = parser.parse_args()
    if args.mode == 'gate':
        check_gate(json.loads(os.environ['NEEDS_JSON']))
        print('CI gate passed: every required check and release verification succeeded.')
        return
    head = os.environ['GITHUB_SHA']
    if not re.fullmatch(r'[a-f0-9]{40,64}', head):
        raise ValueError('Invalid checked-out Git SHA')
    if args.mode == 'deploy':
        latest = subprocess.check_output(['git', 'ls-remote', 'origin', 'refs/heads/main'], text=True).split()
        latest = latest[0] if latest else ''
        if not re.fullmatch(r'[a-f0-9]{40,64}', latest):
            raise ValueError('Cannot verify current main revision')
        paths = []
        if head != latest:
            subprocess.check_call(['git', 'fetch', '--no-tags', '--depth=1', 'origin', latest])
            files = subprocess.check_output(['git', 'diff', '--no-renames', '--name-only', '-z', head, latest, '--'])
            paths = [p.decode('utf-8', errors='surrogateescape') for p in files.split(b'\0') if p]
        allowed = deployment_allowed(head, latest, paths)
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write(f'current={str(allowed).lower()}\n')
        print('Verified runtime release is current.' if allowed else 'Deployment skipped: main has newer executable changes.')
        return
    payload = json.loads(pathlib.Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    if os.environ['GITHUB_EVENT_NAME'] == 'push':
        # A previous push may have failed or been superseded. Only a green run
        # is a valid incremental baseline; absent history means full validation.
        payload['before'] = successful_base(os.environ.get('GITHUB_REPOSITORY', ''), os.environ.get('GH_TOKEN', ''))
    paths, force = changed_paths(os.environ['GITHUB_EVENT_NAME'], payload, head)
    plan = classify(paths, force)
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        for key, value in plan.items():
            output.write(f'{key}={str(value).lower()}\n')
    print(json.dumps(plan, indent=2))


if __name__ == '__main__':
    main()

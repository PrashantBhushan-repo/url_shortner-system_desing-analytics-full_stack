import importlib.util
import io
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest
import urllib.error
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


plan = load('ci-plan')
images = load('ci-images')


class ChangePlanningTests(unittest.TestCase):
    def test_documentation_cannot_drop_a_verified_pending_deployment(self):
        self.assertTrue(plan.deployment_allowed('a' * 40, 'b' * 40, ['README.md']))
        self.assertTrue(plan.deployment_allowed('a' * 40, 'a' * 40, []))
        for path in ['frontend/src/App.jsx', 'backend/src/app.js', 'infrastructure/compose.production.yml', '.node-version']:
            self.assertFalse(plan.deployment_allowed('a' * 40, 'b' * 40, [path]))
        with self.assertRaises(ValueError):
            plan.deployment_allowed('a' * 40, '', [])

    def test_incremental_push_uses_green_run_not_previous_failed_push(self):
        response = io.BytesIO(json.dumps({'workflow_runs': [{'head_sha': 'b' * 40}]}).encode())
        with patch.object(plan.urllib.request, 'urlopen', return_value=response) as api:
            self.assertEqual(plan.successful_base('owner/repo', 'private-token'), 'b' * 40)
        self.assertIn('status=success', api.call_args.args[0].full_url)
        self.assertIsNone(plan.successful_base('owner/repo', ''))

    def test_unavailable_green_history_falls_back_to_full_checks(self):
        with patch.object(plan.urllib.request, 'urlopen', side_effect=urllib.error.URLError('offline')), patch('sys.stdout', new_callable=io.StringIO):
            self.assertIsNone(plan.successful_base('owner/repo', 'private-token'))

    def test_documentation_only_has_no_release(self):
        result = plan.classify(['README.md', 'infrastructure/DEPLOYMENT.md', 'docs/guide.md', 'image/example.png'])
        self.assertFalse(any(result.values()))

    def test_frontend_does_not_start_database_regressions(self):
        self.assertEqual(plan.classify(['frontend/src/pages/Home.jsx']), dict(
            backend=False, frontend=True, infrastructure=False, release=True, refresh=False))

    def test_backend_includes_frontend_socket_contract_checks(self):
        result = plan.classify(['backend/package-lock.json'])
        self.assertTrue(result['backend'] and result['frontend'] and result['release'])

    def test_infrastructure_release_reuses_unchanged_app_images(self):
        result = plan.classify(['infrastructure/nginx/https.conf.template'])
        self.assertTrue(result['infrastructure'] and result['release'])
        self.assertFalse(result['backend'] or result['frontend'])

    def test_shared_and_unknown_changes_are_conservative(self):
        for path in ['.node-version', '.github/workflows/frontend.yml', '.dockerignore', 'new-unknown-script.sh']:
            result = plan.classify([path])
            self.assertTrue(all(result[key] for key in ['backend', 'frontend', 'infrastructure', 'release']), path)

    def test_schedule_manual_and_first_push_force_full_refresh(self):
        for event in ['schedule', 'workflow_dispatch']:
            files, force = plan.changed_paths(event, {}, 'a' * 40)
            self.assertTrue(all(plan.classify(files, force).values()))
        self.assertTrue(plan.changed_paths('push', {'before': '0' * 40}, 'a' * 40)[1])

    def test_complete_diff_includes_deleted_renamed_paths_and_spaces(self):
        paths = b'backend/old file.js\0frontend/new file.jsx\0'
        with patch.object(plan.subprocess, 'check_output', return_value=paths) as git:
            files, force = plan.changed_paths('pull_request', {'pull_request': {'base': {'sha': 'b' * 40}}}, 'a' * 40)
        self.assertEqual(files, ['backend/old file.js', 'frontend/new file.jsx'])
        self.assertFalse(force)
        self.assertIn('--no-renames', git.call_args.args[0])

    def test_missing_git_base_runs_full_checks_instead_of_skipping(self):
        with patch.object(plan.subprocess, 'check_output', side_effect=subprocess.CalledProcessError(1, 'git')):
            self.assertTrue(plan.changed_paths('push', {'before': 'b' * 40}, 'a' * 40)[1])

    def test_required_gate_rejects_skipped_failed_cancelled_or_missing_checks(self):
        for enabled in (True, False):
            expected = 'success' if enabled else 'skipped'
            needs = {'changes': {'result': 'success', 'outputs': {key: str(enabled).lower() for key in ['backend', 'frontend', 'infrastructure', 'release']}}}
            needs.update({job: {'result': expected} for job in ['backend', 'frontend', 'infrastructure', 'build']})
            plan.check_gate(needs)
            for result in ['failure', 'cancelled', 'skipped' if enabled else 'success']:
                broken = json.loads(json.dumps(needs))
                broken['build']['result'] = result
                with self.assertRaises(ValueError):
                    plan.check_gate(broken)
            del needs['changes']['outputs']['release']
            with self.assertRaises(ValueError):
                plan.check_gate(needs)


class ImageReuseTests(unittest.TestCase):
    def test_real_git_cli_builds_pr_images_without_registry_and_preserves_unchanged_fingerprints(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            def git(*args):
                return subprocess.check_output(['git', '-C', folder, *args], text=True, stderr=subprocess.DEVNULL).strip()
            git('init')
            for path in ['backend/app.js', 'frontend/app.js', '.node-version', '.github/workflows/ci-cd.yml', 'infrastructure/scripts/ci-images.py']:
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text('fixture\n')
            git('add', '.')
            git('-c', 'user.name=CI test', '-c', 'user.email=ci@example.test', 'commit', '-m', 'fixture')
            def run_images(package_name=''):
                output = root / 'image-output'
                output.unlink(missing_ok=True)
                env = dict(os.environ, GITHUB_REPOSITORY='owner/repo', PUBLISH_IMAGES='false', REFRESH_IMAGES='false', GITHUB_OUTPUT=str(output), GH_TOKEN='', GHCR_PACKAGE_NAMESPACE=package_name)
                subprocess.check_output([sys.executable, str(ROOT / 'scripts/ci-images.py'), 'plan'], cwd=folder, env=env)
                return dict(line.split('=', 1) for line in output.read_text().splitlines())
            before = run_images()
            (root / 'frontend/app.js').write_text('updated\n')
            git('add', 'frontend/app.js')
            git('-c', 'user.name=CI test', '-c', 'user.email=ci@example.test', 'commit', '-m', 'frontend')
            after = run_images()
            self.assertEqual(before['backend_source_tag'], after['backend_source_tag'])
            self.assertEqual(before['migration_source_tag'], after['migration_source_tag'])
            self.assertNotEqual(before['frontend_source_tag'], after['frontend_source_tag'])
            self.assertTrue(all(after[k + '_build'] == 'true' for k in images.KINDS[:-1]))
            custom = run_images('pburls-production-v2')
            self.assertEqual(custom['prefix'], 'ghcr.io/owner/pburls-production-v2')
            for kind in images.KINDS[:-1]:
                self.assertTrue(custom[kind + '_source_tag'].startswith(custom['prefix'] + '-' + kind + ':source-'))

    def test_namespace_never_reuses_old_public_package_names(self):
        self.assertEqual(images.namespace('Owner/Repo'), ('owner', 'repo-private', 'ghcr.io/owner/repo-private'))
        with self.assertRaises(ValueError):
            images.namespace('owner/repo; shell')

    def test_custom_namespace_updates_all_four_privacy_checks_without_changing_owner(self):
        with patch.dict(os.environ, {'GHCR_PACKAGE_NAMESPACE': 'pburls-production-v2'}):
            registry = images.Registry('Owner/Repo')
        self.assertEqual(registry.prefix, 'ghcr.io/owner/pburls-production-v2')
        with patch.object(registry, 'api', side_effect=lambda path: {'owner': {'type': 'User'}} if path.startswith('repos/') else {'visibility': 'private'}) as api:
            registry.verify(False)
        self.assertEqual([call.args[0] for call in api.call_args_list[1:]], [
            'users/owner/packages/container/pburls-production-v2-' + kind for kind in images.KINDS])
        for value in ['Owner/Repo', 'ghcr.io/owner/pkg', 'UPPERCASE', '../bad', '-bad', 'bad ', 'x' * 201]:
            with self.assertRaises(ValueError):
                images.namespace('owner/repo', value)

    def test_public_package_recovery_is_actionable_and_never_changes_visibility(self):
        registry = images.Registry('owner/repo')
        with patch.object(registry, 'api', side_effect=lambda path: {'owner': {'type': 'User'}} if path.startswith('repos/') else {'visibility': 'public'}):
            with self.assertRaisesRegex(ValueError, "visibility='public'.*GHCR_PACKAGE_NAMESPACE"):
                registry.verify(True)

    def test_immediate_post_push_check_does_not_require_unbuilt_packages(self):
        registry = images.Registry('owner/repo')
        with patch.object(registry, 'api', side_effect=lambda path: {'owner': {'type': 'User'}} if path.startswith('repos/') else {'visibility': 'private'}) as api:
            registry.verify(False, kinds=('backend',))
        self.assertEqual(len(api.call_args_list), 2)
        self.assertTrue(api.call_args_list[-1].args[0].endswith('-backend'))
        with patch.dict(os.environ, {'GITHUB_REPOSITORY': 'owner/repo'}), patch('sys.argv', ['ci-images.py', 'verify', '--kind', 'migration']), patch.object(images.Registry, 'verify') as verify, patch('sys.stdout', new_callable=io.StringIO):
            images.main()
        verify.assert_called_once_with(allow_missing=False, kinds=('migration',))

    def test_all_four_packages_must_be_private_after_publication(self):
        registry = images.Registry('owner/repo')
        for state in ['private', 'public', None]:
            def api(path):
                return {'owner': {'type': 'User'}} if path == 'repos/owner/repo' else ({'visibility': state} if state else None)
            with patch.object(registry, 'api', side_effect=api):
                if state == 'private':
                    registry.verify(False)
                else:
                    with self.assertRaises(ValueError):
                        registry.verify(False)
                if state is None:
                    registry.verify(True)

    def test_organization_packages_use_the_correct_api_route(self):
        registry = images.Registry('team/repo')
        with patch.object(registry, 'api', side_effect=lambda path: {'owner': {'type': 'Organization'}} if path.startswith('repos/') else {'visibility': 'private'}) as api:
            registry.verify(False)
        self.assertTrue(all(call.args[0].startswith('orgs/team/packages/') for call in api.call_args_list[1:]))

    def test_api_denials_do_not_become_cache_misses_or_expose_tokens(self):
        registry = images.Registry('owner/repo')
        for status in [401, 403, 429, 500]:
            error = urllib.error.HTTPError('https://api.github.com/test', status, 'private-token', {}, None)
            with patch.dict(os.environ, {'GH_TOKEN': 'private-token'}), patch.object(images.urllib.request, 'urlopen', side_effect=error):
                with self.assertRaises(RuntimeError) as caught:
                    registry.api('test')
                self.assertNotIn('private-token', str(caught.exception))

    def test_registry_digest_must_be_valid_and_missing_tags_build(self):
        digest = 'sha256:' + 'a' * 64
        response = subprocess.CompletedProcess([], 0, json.dumps({'digest': digest}), '')
        with patch.object(images.subprocess, 'run', return_value=response):
            self.assertEqual(images.inspect_digest('ghcr.io/owner/repo:source-test'), digest)
        for stderr, missing in [('manifest unknown', True), ('404 Not Found', True), ('unauthorized', False), ('connection refused', False)]:
            response = subprocess.CompletedProcess([], 1, '', stderr)
            with patch.object(images.subprocess, 'run', return_value=response):
                if missing:
                    self.assertIsNone(images.inspect_digest('test'))
                else:
                    with self.assertRaises(RuntimeError):
                        images.inspect_digest('test')
        with patch.object(images.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '{"digest":"latest"}', '')):
            with self.assertRaises(ValueError):
                images.inspect_digest('test')

    def test_fingerprints_are_component_specific_and_include_build_policy(self):
        with patch.object(images.subprocess, 'check_output', side_effect=lambda args, **kwargs: args[-1] + '-tree') as git:
            backend = images.fingerprint('backend')
            self.assertNotEqual(backend, images.fingerprint('migration'))
            self.assertNotEqual(backend, images.fingerprint('frontend'))
        self.assertTrue(any('HEAD:.github/workflows/ci-cd.yml' in call.args[0] for call in git.call_args_list))

    def test_prs_build_without_registry_access_and_refresh_rebuilds_all(self):
        for publish, refresh in [('false', 'false'), ('true', 'true')]:
            with tempfile.TemporaryDirectory() as folder:
                output = pathlib.Path(folder) / 'outputs'
                with patch.dict(os.environ, {'GITHUB_REPOSITORY': 'owner/repo', 'PUBLISH_IMAGES': publish, 'REFRESH_IMAGES': refresh, 'GITHUB_OUTPUT': str(output)}), patch('sys.argv', ['ci-images.py', 'plan']), patch.object(images, 'fingerprint', return_value='a' * 64), patch.object(images.Registry, 'verify') as verify, patch.object(images, 'inspect_digest') as inspect, patch('sys.stdout', new_callable=io.StringIO):
                    images.main()
                self.assertEqual(verify.call_count, 1 if publish == 'true' else 0)
                inspect.assert_not_called()
                values = dict(line.split('=', 1) for line in output.read_text().splitlines())
                self.assertTrue(all(values[k + '_build'] == 'true' for k in images.KINDS[:-1]))

    def test_only_missing_source_images_are_built(self):
        with tempfile.TemporaryDirectory() as folder:
            output = pathlib.Path(folder) / 'outputs'
            digest = 'sha256:' + 'a' * 64
            with patch.dict(os.environ, {'GITHUB_REPOSITORY': 'owner/repo', 'PUBLISH_IMAGES': 'true', 'REFRESH_IMAGES': 'false', 'GITHUB_OUTPUT': str(output)}), patch('sys.argv', ['ci-images.py', 'plan']), patch.object(images, 'fingerprint', return_value='b' * 64), patch.object(images.Registry, 'verify'), patch.object(images, 'inspect_digest', side_effect=[digest, digest, None]), patch('sys.stdout', new_callable=io.StringIO):
                images.main()
            values = dict(line.split('=', 1) for line in output.read_text().splitlines())
            self.assertEqual([values[k + '_build'] for k in images.KINDS[:-1]], ['false', 'false', 'true'])
            self.assertEqual(values['backend_digest'], digest)


if __name__ == '__main__':
    unittest.main()

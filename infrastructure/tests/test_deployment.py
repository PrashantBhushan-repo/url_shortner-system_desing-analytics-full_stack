import importlib.util
import os
import pathlib
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / f'{name}.py')
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


settings = module('settings')
dispatch = module('dispatch')


class DeploymentTests(unittest.TestCase):
    def test_settings_exporter_accepts_every_setting_requested_by_release_loader(self):
        common = (ROOT / 'scripts/common.sh').read_text()
        requested = re.search(r'exports "\$RUNTIME_ENV" ([A-Z_ ]+)\)', common).group(1).split()
        self.assertIn('OBSERVABILITY_ENABLED', requested)
        with tempfile.TemporaryDirectory() as folder:
            runtime = pathlib.Path(folder) / 'runtime.env'
            runtime.write_text('DOMAIN=short.company.test\nOBSERVABILITY_ENABLED=true\nJWT_SECRET=not-exported\n')
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/settings.py'), 'exports', str(runtime), *requested], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('export OBSERVABILITY_ENABLED=true', result.stdout)
            self.assertNotIn('JWT_SECRET', result.stdout)
            bad = subprocess.run([sys.executable, str(ROOT / 'scripts/settings.py'), 'exports', str(runtime), 'DOMAIN', 'JWT_SECRET'], capture_output=True, text=True)
            self.assertNotEqual(bad.returncode, 0)
            self.assertEqual(bad.stdout, '')

    @unittest.skipIf(os.name == 'nt' or not shutil.which('bash'), 'Requires Bash on Linux')
    def test_shell_loader_handles_real_exports_and_never_evaluates_failed_exporter_output(self):
        for fail in (False, True):
            with tempfile.TemporaryDirectory() as folder:
                directory = pathlib.Path(folder)
                releases = directory / 'releases'
                release = releases / ('a' * 40 + '-' + 'b' * 12)
                scripts = release / 'infrastructure/scripts'
                scripts.mkdir(parents=True)
                (release / 'release.env').write_text('APP_VERSION=fixture\n')
                runtime = directory / 'runtime.env'
                runtime.write_text('DOMAIN=short.company.test\nOBSERVABILITY_ENABLED=true\n')
                exporter = 'import sys\nprint("echo UNSAFE_EVALUATION")\nsys.exit(9)\n' if fail else (ROOT / 'scripts/settings.py').read_text()
                (scripts / 'settings.py').write_text(exporter)
                # Keep the production guard; substitute only the test's release root.
                common = (ROOT / 'scripts/common.sh').read_text().replace('^/opt/pburls/releases/', '^' + re.escape(str(releases)) + '/')
                fixture = directory / 'common.sh'
                fixture.write_text(common)
                command = f'''set -Eeuo pipefail
source {shlex.quote(str(fixture))}
RUNTIME_ENV={shlex.quote(str(runtime))}
trap 'echo "Deployment failed."; exit 41' ERR
load_release {shlex.quote(str(release))}
printf 'loaded:%s\\n' "$OBSERVABILITY_ENABLED"
'''
                result = subprocess.run(['bash', '-c', command], capture_output=True, text=True)
                if fail:
                    self.assertEqual(result.returncode, 41, result.stderr)
                    self.assertNotIn('UNSAFE_EVALUATION', result.stdout)
                    self.assertNotIn('command not found', result.stderr)
                    self.assertNotIn('loaded:', result.stdout)
                else:
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertIn('loaded:true', result.stdout)

    def test_deployment_config_rejects_bad_target_without_aws_calls(self):
        for value in ['', '52.65.189.62', 'arn:aws:ec2:region:account:instance/i-12345678', 'i-123456789', 'i-1234567890123456', 'i-12345678; command']:
            with patch.dict(dispatch.os.environ, {'EC2_INSTANCE_ID': value}, clear=True), patch.object(dispatch, 'aws') as aws:
                with self.assertRaisesRegex(ValueError, 'repository VARIABLE EC2_INSTANCE_ID'):
                    dispatch.check_configuration()
                aws.assert_not_called()

    def test_config_only_accepts_valid_targets_without_dispatch_or_bundle(self):
        for instance in ['i-12345678', 'i-0123456789abcdef0']:
            env = {'EC2_INSTANCE_ID': ' ' + instance + '\n', 'GHCR_PULL_USERNAME': 'owner', 'AWS_REGION': 'ap-southeast-2'}
            with patch.dict(dispatch.os.environ, env, clear=True), patch('sys.argv', ['dispatch.py', '--check-config']), patch.object(dispatch, 'aws') as aws, patch('builtins.print'):
                dispatch.main()
                aws.assert_not_called()

    def test_rollback_validation_does_not_require_pull_username(self):
        with patch.dict(dispatch.os.environ, {'EC2_INSTANCE_ID': 'i-0123456789abcdef0'}, clear=True):
            self.assertEqual(dispatch.check_configuration(rollback=True), 'i-0123456789abcdef0')
            with self.assertRaisesRegex(ValueError, 'GHCR_PULL_USERNAME'):
                dispatch.check_configuration()

    def test_bad_parameter_prefix_fails_before_any_cloud_command(self):
        with patch.dict(dispatch.os.environ, {'EC2_INSTANCE_ID': 'i-0123456789abcdef0', 'GHCR_PULL_USERNAME': 'owner', 'PARAMETER_PREFIX': '/pburls/../other'}, clear=True):
            with self.assertRaisesRegex(ValueError, 'PARAMETER_PREFIX'):
                dispatch.check_configuration()

    def test_aws_dispatch_uses_selected_region(self):
        with patch.dict(dispatch.os.environ, {'AWS_REGION': 'ap-southeast-2'}), patch.object(dispatch.subprocess, 'check_output', return_value='{}') as execute:
            self.assertEqual(dispatch.aws('ssm', 'describe-instance-information'), {})
        self.assertEqual(execute.call_args.args[0], [
            'aws', 'ssm', 'describe-instance-information', '--region', 'ap-southeast-2', '--output', 'json'])

    def test_explicit_region_is_passed_to_host_and_invalid_regions_fail(self):
        with patch.dict(dispatch.os.environ, {'AWS_REGION': 'us-east-1'}):
            self.assertEqual(dispatch.region(), 'us-east-1')
            commands = dispatch.deployment_commands('ghcr.io/owner/repo-ops@sha256:' + 'a' * 64, 'b' * 40, 'owner', '/pburls/production')
            self.assertIn('AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1', commands[1])
        with patch.dict(dispatch.os.environ, {'AWS_REGION': 'bad; command'}):
            with self.assertRaises(ValueError):
                dispatch.region()

    def test_literal_secrets_are_not_executed_or_expanded(self):
        with tempfile.TemporaryDirectory() as folder:
            path = pathlib.Path(folder) / 'runtime.env'
            path.write_text("SECRET='$(touch /tmp/never-run)$HOME#literal'\nDOMAIN=short.company.test\nEMPTY=\n")
            data = settings.read_env(path)
            self.assertEqual(data['SECRET'], '$(touch /tmp/never-run)$HOME#literal')
            self.assertEqual(data['EMPTY'], '')

    def test_ambiguous_duplicate_settings_fail(self):
        with tempfile.TemporaryDirectory() as folder:
            path = pathlib.Path(folder) / 'runtime.env'
            path.write_text('DOMAIN=a.company.test\nDOMAIN=b.company.test\n')
            with self.assertRaises(ValueError):
                settings.read_env(path)

    def test_domain_cannot_inject_nginx_configuration(self):
        for value in ['example.com; return 200;', 'https://example.com', '../certs', 'localhost', 'bad_domain.com']:
            with self.assertRaises(ValueError):
                settings.domain_name(value)
        self.assertEqual(settings.domain_name('short.company.test'), 'short.company.test')

    def test_deploy_requires_immutable_digest_and_safe_arguments(self):
        image = 'ghcr.io/owner/repo-ops@sha256:' + 'a' * 64
        commands = dispatch.deployment_commands(image, 'b' * 40, 'owner', '/pburls/production')
        self.assertEqual(len(commands), 2)
        self.assertIn('docker cp', commands[1])
        self.assertIn('b' * 40 + '-' + 'a' * 12, commands[1])
        self.assertNotIn('s3', commands[1])
        for bad in ['ghcr.io/owner/repo:latest', image + '; touch /tmp/bad']:
            with self.assertRaises(ValueError):
                dispatch.deployment_commands(bad, 'b' * 40, 'owner', '/pburls/production')
        with self.assertRaises(ValueError):
            dispatch.deployment_commands(image, 'b' * 40, 'owner;bad', '/pburls/production')

    def test_public_urls_and_certificate_hostname_must_agree(self):
        values = {'DOMAIN': 'short.company.test', 'BASE_URL': 'https://short.company.test',
                  'CLIENT_URL': 'https://short.company.test', 'LETSENCRYPT_EMAIL': 'ops@company.test'}
        settings.validate_runtime(values)
        with self.assertRaises(ValueError):
            settings.validate_runtime({**values, 'CLIENT_URL': 'https://different.company.test'})


if __name__ == '__main__':
    unittest.main()

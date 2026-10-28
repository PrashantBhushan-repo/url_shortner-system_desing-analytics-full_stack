import importlib.util
import pathlib
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

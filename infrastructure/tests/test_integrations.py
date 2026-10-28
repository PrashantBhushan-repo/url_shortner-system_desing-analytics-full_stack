import importlib.util
import json
import os
import pathlib
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('integrations', pathlib.Path(__file__).resolve().parents[1] / 'scripts/update-integrations.py')
integrations = importlib.util.module_from_spec(spec)
spec.loader.exec_module(integrations)

BASE = "NODE_ENV=production\nDOMAIN=pburls.online\nDB_PASSWORD='keep-$-#-unchanged'\nJWT_SECRET=keep-unchanged\nDATA_VOLUME_ID=vol-keep\nALLOW_FORMAT_DATA_VOLUME=false\nRAZORPAY_KEY_ID=old\n"
PATCH = {'RAZORPAY_KEY_ID': 'rzp_test_fixture', 'RAZORPAY_KEY_SECRET': 'fixture-only',
         'SMTP_HOST': 'smtp.fixture.test', 'SMTP_PORT': '587', 'SMTP_SECURE': 'false',
         'SMTP_USER': 'fixture', 'SMTP_PASS': 'literal-$-#-value', 'FROM_EMAIL': 'fixture@company.test',
         'BYPASS_EMAIL_ERROR': 'false', 'GOOGLE_CLIENT_ID': 'fixture-client',
         'GOOGLE_CLIENT_SECRET': 'fixture-secret', 'GOOGLE_REDIRECT_URI': 'https://pburls.online/api/auth/oauth/google/callback'}


class IntegrationMergeTests(unittest.TestCase):
    def test_preserves_every_unrelated_runtime_line_and_quotes_literal_credentials(self):
        merged = integrations.merge(BASE, PATCH, 'pburls.online')
        for line in BASE.splitlines():
            if not line.startswith('RAZORPAY_KEY_ID='):
                self.assertIn(line + '\n', merged)
        self.assertIn("SMTP_PASS='literal-$-#-value'", merged)
        self.assertNotIn('RAZORPAY_KEY_ID=old', merged)
        self.assertEqual(merged.count('RAZORPAY_KEY_ID='), 1)

    def test_rejects_live_mode_database_overrides_wrong_callbacks_and_email_bypass(self):
        for changes in [{'RAZORPAY_KEY_ID': 'rzp_live_fixture'}, {'DB_PASSWORD': 'overwrite'},
                        {'GOOGLE_REDIRECT_URI': 'http://localhost:5000/api/auth/oauth/google/callback'},
                        {'BYPASS_EMAIL_ERROR': 'true'}, {'SMTP_PASS': 'bad\nvalue'}, {'SMTP_PORT': 'invalid'}]:
            with self.assertRaises(ValueError):
                integrations.merge(BASE, {**PATCH, **changes}, 'pburls.online')
        for base in [BASE.replace('pburls.online', 'another.test'), BASE.replace('NODE_ENV=production', 'NODE_ENV=development'), BASE + 'JWT_SECRET=duplicate\n']:
            with self.assertRaises(ValueError):
                integrations.merge(base, PATCH, 'pburls.online')

    def test_cloud_update_preserves_key_tier_and_does_not_put_secrets_in_arguments(self):
        with tempfile.TemporaryDirectory() as folder:
            filename = pathlib.Path(folder) / 'patch.json'
            filename.write_text(json.dumps(PATCH))
            state = {'value': BASE, 'request_path': None, 'writes': 0}
            def run(args, **kwargs):
                operation = args[2]
                if operation == 'get-caller-identity':
                    result = {'Account': '460047017508'}
                elif operation == 'get-parameter':
                    result = {'Parameter': {'Type': 'SecureString', 'Value': state['value'], 'Version': 1}}
                elif operation == 'describe-parameters':
                    result = {'Parameters': [{'Name': '/pburls/production/runtime-env', 'KeyId': 'alias/custom-fixture', 'Tier': 'Standard'}]}
                elif operation == 'put-parameter':
                    state['writes'] += 1
                    state['request_path'] = pathlib.Path(args[args.index('--cli-input-json') + 1][7:])
                    request = json.loads(state['request_path'].read_text())
                    self.assertEqual(request['KeyId'], 'alias/custom-fixture')
                    self.assertEqual(request['Tier'], 'Standard')
                    self.assertEqual(request['Type'], 'SecureString')
                    self.assertNotIn('fixture-only', ' '.join(args))
                    if os.name != 'nt':
                        self.assertEqual(state['request_path'].stat().st_mode & 0o777, 0o600)
                    state['value'] = request['Value']
                    result = {'Version': 2}
                else:
                    self.fail('Unexpected AWS operation')
                return subprocess.CompletedProcess(args, 0, json.dumps(result), '')
            with patch('sys.argv', ['update-integrations.py', '--patch', str(filename), '--account', '460047017508']), patch.object(integrations.subprocess, 'run', side_effect=run), patch('builtins.print'):
                integrations.main()
            self.assertEqual(state['writes'], 1)
            self.assertIn("DB_PASSWORD='keep-$-#-unchanged'", state['value'])
            self.assertFalse(state['request_path'].exists())


if __name__ == '__main__':
    unittest.main()

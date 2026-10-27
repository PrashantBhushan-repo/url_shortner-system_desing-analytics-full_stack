import importlib.util
import pathlib
import unittest

path = pathlib.Path(__file__).resolve().parents[1] / 'observability' / 'validate-env.py'
spec = importlib.util.spec_from_file_location('observability_env', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ObservabilityConfigurationTests(unittest.TestCase):
    def valid(self):
        return {'OTLP_ENDPOINT': 'https://otlp-gateway-test.grafana.net/otlp', 'OTLP_USERNAME': '12345',
                'OTLP_PASSWORD': 'private-test-token', 'OBS_POSTGRES_PASSWORD': 'a' * 64}

    def test_cloud_credentials_validated_without_disclosing_values(self):
        module.validate(self.valid())
        for key, value in [('OTLP_ENDPOINT', 'http://private-test-token@untrusted.example/'),
                           ('OTLP_USERNAME', 'placeholder'), ('OTLP_PASSWORD', 'REPLACE_WITH_TOKEN'),
                           ('OBS_POSTGRES_PASSWORD', "private-test-token'; DROP ROLE x;")]:
            values = self.valid()
            values[key] = value
            with self.assertRaises(ValueError) as caught:
                module.validate(values)
            self.assertNotIn('private-test-token', str(caught.exception))

if __name__ == '__main__':
    unittest.main()

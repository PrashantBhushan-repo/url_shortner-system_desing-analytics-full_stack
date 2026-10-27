"""Validate monitoring credentials without displaying them."""
import pathlib
import re
import sys
from urllib.parse import urlsplit
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
from settings import read_env

def validate(values):
    url = urlsplit(values.get('OTLP_ENDPOINT', ''))
    if url.scheme != 'https' or not url.hostname or not url.hostname.endswith('.grafana.net') or url.username or url.password or url.query or url.fragment:
        raise ValueError('Use the Grafana Cloud HTTPS OTLP gateway endpoint')
    if not values.get('OTLP_USERNAME', '').isdigit():
        raise ValueError('Set the numeric Grafana Cloud instance ID')
    if not values.get('OTLP_PASSWORD') or values['OTLP_PASSWORD'].startswith('REPLACE_'):
        raise ValueError('Set a Grafana Cloud write token')
    if not re.fullmatch('[0-9a-f]{64}', values.get('OBS_POSTGRES_PASSWORD', '')):
        raise ValueError('Use a random 64-character hexadecimal monitoring password')

if __name__ == '__main__':
    validate(read_env(sys.argv[1]))
    print('Observability configuration valid; no secrets displayed.')

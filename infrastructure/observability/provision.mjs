// Usage: GRAFANA_URL + GRAFANA_TOKEN + GRAFANA_PROMETHEUS_UID in your shell.
// Credentials are used only for this operation and are never saved to the repo.
import fs from 'node:fs';
import { alertChecks, alertThresholds } from './alert-rules.mjs';
// Validate all tuning before any remote writes; an invalid override changes nothing.
const thresholds = alertThresholds(process.env.PBURLS_ALERT_THRESHOLDS_JSON);
const url = new URL(process.env.GRAFANA_URL || 'http://localhost:3001');
if (url.username || url.password) throw new Error('Use a Grafana URL without credentials; supply the service-account token separately');
const local = ['localhost', '127.0.0.1'].includes(url.hostname);
if (!local && (url.protocol !== 'https:' || !process.env.GRAFANA_TOKEN)) throw new Error('Use HTTPS and a Grafana service-account token for remote provisioning');
const datasourceUid = process.env.GRAFANA_PROMETHEUS_UID || (local ? 'prometheus' : '');
if (!datasourceUid) throw new Error('Set GRAFANA_PROMETHEUS_UID to your Cloud metrics datasource UID');
const logsUid = process.env.GRAFANA_LOKI_UID || (local ? 'loki' : '');
if (!logsUid) throw new Error('Set GRAFANA_LOKI_UID to your Cloud logs datasource UID');
const environment = process.env.OBS_ENVIRONMENT || (local ? 'development' : 'production');
if (!['development', 'production', 'test'].includes(environment)) throw new Error('Invalid OBS_ENVIRONMENT');
async function api(endpoint, method = 'GET', body) {
  const response = await fetch(new URL(endpoint, url), { method,
    headers: { 'Content-Type': 'application/json', ...(process.env.GRAFANA_TOKEN ? { Authorization: `Bearer ${process.env.GRAFANA_TOKEN}` } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  if (response.status === 404 && method === 'GET') return null;
  if (!response.ok) throw new Error(`Grafana API failed (${response.status}) at ${endpoint}`);
  return response.status === 204 ? {} : response.json();
}
if (!await api('/api/folders/pburls')) await api('/api/folders', 'POST', { uid: 'pburls', title: 'PBUrls' });
for (const file of fs.readdirSync(new URL('./grafana/dashboards/', import.meta.url))) {
  const dashboard = JSON.parse(fs.readFileSync(new URL(`./grafana/dashboards/${file}`, import.meta.url)));
  dashboard.templating.list.find(v => v.name === 'environment').current = { text: environment, value: environment };
  dashboard.templating.list.find(v => v.name === 'metrics').current = { text: datasourceUid, value: datasourceUid };
  dashboard.templating.list.find(v => v.name === 'logs').current = { text: logsUid, value: logsUid };
  await api('/api/dashboards/db', 'POST', { dashboard, folderUid: 'pburls', overwrite: true });
}
for (const [name, title, expr, expression, duration, description] of alertChecks(environment, thresholds)) {
  const uid = `pburls-${name}-${environment}`;
  const rule = { uid, orgID: 1, folderUID: 'pburls', ruleGroup: `PBUrls ${environment}`, title: `${title} (${environment})`,
    condition: 'B', for: duration, noDataState: 'OK', execErrState: 'Error',
    labels: { application: 'pburls', environment }, annotations: { summary: title, description },
    data: [
      { refId: 'A', relativeTimeRange: { from: 600, to: 0 }, datasourceUid, model: { refId: 'A', expr, instant: true, range: false, intervalMs: 15000, maxDataPoints: 43200 } },
      { refId: 'B', relativeTimeRange: { from: 0, to: 0 }, datasourceUid: '__expr__', model: { refId: 'B', type: 'math', expression, datasource: { type: '__expr__', uid: '__expr__' } } },
    ],
  };
  const existing = await api(`/api/v1/provisioning/alert-rules/${uid}`);
  await api(`/api/v1/provisioning/alert-rules${existing ? `/${uid}` : ''}`, existing ? 'PUT' : 'POST', rule);
}
console.log('PBUrls dashboards and eleven alert rules provisioned. Configure a contact point and notification policy in Grafana to receive notifications.');

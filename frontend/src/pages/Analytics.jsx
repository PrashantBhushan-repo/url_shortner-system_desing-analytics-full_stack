import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams, useLocation, useNavigate } from "react-router-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend
} from "recharts";
import {
  Activity, ArrowLeft, ArrowUp, BarChart3, Download,
  ExternalLink, Globe, Loader2, LockKeyhole, Monitor,
  MousePointer2, QrCode, RefreshCw, Smartphone, Users, Wifi, WifiOff, Zap
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import API from "../services/urlApi";
import { API_BASE_URL } from '../services/apiConfig';
import { createAnalyticsSocket } from '../services/analyticsSocket';
import { loadLinkReport } from "../services/analyticsApi";
import WorkspaceShell from "../layout/WorkspaceShell";
import LocationExplorer from '../components/analytics/LocationExplorer';
import "./analytics.css";

/* ─── colour palette ─────────────────────────────────── */
const PALETTE = ['#2d9a5f','#6c63e0','#f59e42','#3b82f6','#ec4899','#10b981','#f43f5e','#8b5cf6'];
const fmt = v => Number(v || 0).toLocaleString();
const pct = (v, t) => t ? (v / t * 100).toFixed(1) + '%' : '—';

/* ─── custom tooltip ─────────────────────────────────── */
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="an-tooltip">
      <span className="an-tip-label">{label}</span>
      {payload.map(p => (
        <span key={p.dataKey} className="an-tip-row">
          <span className="an-tip-dot" style={{ background: p.color }} />
          {p.name}: <strong>{fmt(p.value)}</strong>
        </span>
      ))}
    </div>
  );
}

/* ─── stat card ──────────────────────────────────────── */
function StatCard({ label, value, note, icon: Icon, accent, trend }) {
  return (
    <article className="an-stat">
      <div className="an-stat-top">
        <span className="an-stat-label">{label}</span>
        <span className="an-stat-icon" style={{ '--ic': accent }}><Icon size={16} /></span>
      </div>
      <strong className="an-stat-value">{value}</strong>
      <div className="an-stat-bottom">
        {trend != null && trend > 0 && (
          <span className="an-stat-trend"><ArrowUp size={11} />{trend}%</span>
        )}
        <small>{note}</small>
      </div>
    </article>
  );
}

/* ─── donut pie ──────────────────────────────────────── */
function DonutChart({ title, values = [], nameKey = 'name', locked, unavailable }) {
  const [hovered, setHovered] = useState(null);
  const data = [];
  const seen = new Map();
  for (const item of values) {
    const n = String(item[nameKey] || 'Unknown');
    seen.set(n, (seen.get(n) || 0) + Number(item.count || 0));
  }
  const sorted = [...seen].sort((a, b) => b[1] - a[1]);
  const top5 = sorted.slice(0, 5);
  const rest = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) top5.push(['Other', rest]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  for (let i = 0; i < top5.length; i++) data.push({ name: top5[i][0], value: top5[i][1], color: PALETTE[i] });

  if (locked) return (
    <section className="an-card an-donut-card">
      <div className="an-card-head"><h3>{title}</h3></div>
      <div className="an-locked"><LockKeyhole size={20} /><p>Available on an eligible plan.</p><Link className="an-lock-btn" to="/pricing">Upgrade</Link></div>
    </section>
  );
  if (unavailable) return (
    <section className="an-card an-donut-card">
      <div className="an-card-head"><h3>{title}</h3></div>
      <p className="an-unavail">Report could not be loaded.</p>
    </section>
  );
  if (!total) return (
    <section className="an-card an-donut-card">
      <div className="an-card-head"><h3>{title}</h3></div>
      <div className="an-donut-empty"><span /><p>No data in this period</p></div>
    </section>
  );
  const focused = data.find(d => d.name === hovered);
  return (
    <section className="an-card an-donut-card">
      <div className="an-card-head"><h3>{title}</h3><span className="an-card-badge">{fmt(total)} clicks</span></div>
      <div className="an-donut-wrap">
        <ResponsiveContainer width="100%" height={190} minWidth={0}>
          <PieChart>
            <Pie
              data={data} dataKey="value" nameKey="name"
              innerRadius={58} outerRadius={80} paddingAngle={data.length > 1 ? 3 : 0}
              cornerRadius={4} startAngle={90} endAngle={-270}
              stroke="var(--ws-panel)" strokeWidth={2}
              isAnimationActive={false}
              onMouseEnter={item => setHovered(item.name)}
              onMouseLeave={() => setHovered(null)}
            >
              {data.map(d => <Cell key={d.name} fill={d.color} opacity={!hovered || hovered === d.name ? 1 : 0.25} />)}
            </Pie>
            <Tooltip content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="an-tooltip">
                  <strong>{payload[0].name}</strong>
                  <span>{fmt(payload[0].value)} · {pct(payload[0].value, total)}</span>
                </div>
              ) : null
            } />
          </PieChart>
        </ResponsiveContainer>
        <div className="an-donut-center">
          <strong>{fmt(focused?.value ?? total)}</strong>
          <span>{focused?.name ?? 'total clicks'}</span>
        </div>
      </div>
      <ul className="an-legend">
        {data.map(d => (
          <li key={d.name}
            className={'an-legend-row' + (hovered === d.name ? ' is-hovered' : '')}
            onMouseEnter={() => setHovered(d.name)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="an-legend-dot" style={{ background: d.color }} />
            <span className="an-legend-name" title={d.name}>{d.name}</span>
            <span className="an-legend-val">{fmt(d.value)}</span>
            <span className="an-legend-pct">{pct(d.value, total)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── ranked table ───────────────────────────────────── */
function RankTable({ title, rows = [], nameKey = 'name', icon: Icon, locked, unavailable }) {
  const total = rows.reduce((s, r) => s + Number(r.count || 0), 0);
  if (locked) return (
    <section className="an-card an-rank-card">
      <div className="an-card-head"><Icon size={15} /><h3>{title}</h3></div>
      <div className="an-locked"><LockKeyhole size={20} /><p>Available on an eligible plan.</p><Link className="an-lock-btn" to="/pricing">Upgrade</Link></div>
    </section>
  );
  return (
    <section className="an-card an-rank-card">
      <div className="an-card-head"><Icon size={15} /><h3>{title}</h3>{total > 0 && <span className="an-card-badge">{fmt(total)}</span>}</div>
      {!rows.length || unavailable ? (
        <p className="an-unavail">{unavailable ? 'Report unavailable.' : 'No data in this period.'}</p>
      ) : (
        <div className="an-rank-list">
          {rows.slice(0, 8).map((row, i) => {
            const v = Number(row.count || 0);
            const p = total ? v / total * 100 : 0;
            return (
              <div className="an-rank-row" key={i}>
                <span className="an-rank-num">{i + 1}</span>
                <div className="an-rank-info">
                  <span className="an-rank-name" title={row[nameKey] || 'Unknown'}>{row[nameKey] || 'Unknown'}</span>
                  <div className="an-rank-bar-wrap"><div className="an-rank-bar" style={{ width: `${p}%`, background: PALETTE[i % PALETTE.length] }} /></div>
                </div>
                <span className="an-rank-count">{fmt(v)}</span>
                <span className="an-rank-pct">{p.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ─── live activity feed ─────────────────────────────── */
function LiveFeed({ recentClicks = [], liveClicks = 0, status }) {
  const isLive = status === 'Connected';
  return (
    <section className="an-card an-live-card">
      <div className="an-card-head">
        <h3>Live feed</h3>
        <span className={`an-live-badge${isLive ? ' is-live' : ''}`}>
          {isLive ? <><span className="an-live-dot" /><Wifi size={11} />Live</> : <><WifiOff size={11} />Polling</>}
        </span>
      </div>
      <div className="an-live-stat">
        <Zap size={18} />
        <div>
          <strong>{fmt(liveClicks)}</strong>
          <span>clicks in last 15 min</span>
        </div>
      </div>
      {!recentClicks.length ? (
        <div className="an-live-empty"><Activity size={20} /><p>Waiting for clicks…</p></div>
      ) : (
        <ul className="an-live-list">
          {recentClicks.slice(0, 8).map((tick, i) => (
            <li key={`${tick.timestamp}-${i}`}>
              <Globe size={12} />
              <div className="an-live-info">
                <span>{tick.country || 'Unknown'}</span>
                <small>{tick.device || 'Unknown device'}</small>
              </div>
              <time dateTime={tick.timestamp}>
                {new Date(tick.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </time>
            </li>
          ))}
        </ul>
      )}
      <p className="an-live-note">{isLive ? 'Live events auto-refresh.' : 'Polling every 30s.'} Analytics delay may apply.</p>
    </section>
  );
}

/* ─── main page ──────────────────────────────────────── */
export default function Analytics() {
  const { urlId } = useParams();
  const { user, token } = useAuth();
  return <LinkAnalytics key={`${user?.id}:${urlId}`} urlId={urlId} token={token} />;
}

function LinkAnalytics({ urlId, token }) {
  const location = useLocation();
  const navigate = useNavigate();
  const backTo = location.state?.from?.startsWith('/dashboard') ? location.state.from : '/dashboard';
  const [params, setParams] = useSearchParams();
  const range = ['24h', '7d', '30d'].includes(params.get('range')) ? params.get('range') : '7d';
  const setRange = v => setParams(p => { const n = new URLSearchParams(p); n.set('range', v); return n; }, { preventScrollReset: true });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [live, setLive] = useState('Connecting');
  const req = useRef(0), ab = useRef(null), refreshRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    const seq = ++req.current;
    ab.current?.abort(); ab.current = new AbortController();
    if (!silent) setLoading(true); else setRefreshing(true);
    setError('');
    try {
      const data = await loadLinkReport(API, urlId, range, ab.current.signal);
      if (seq === req.current) setReport(data);
    } catch (err) {
      if (seq === req.current && err.code !== 'ERR_CANCELED')
        setError(err.response?.data?.message || 'Unable to load analytics. Please try again.');
    } finally {
      if (seq === req.current) { setLoading(false); setRefreshing(false); }
    }
  }, [urlId, range]);

  const cancelLoad = useCallback(() => { req.current++; ab.current?.abort(); }, []);

  useEffect(() => { refreshRef.current = load; load(); return cancelLoad; }, [load, cancelLoad]);

  useEffect(() => {
    if (!urlId || !token) return;
    let refreshTimer;
    const connection = createAnalyticsSocket(API_BASE_URL, window.location.origin, token);
    const { socket } = connection;
    socket.on('connect', () => { setLive('Connecting'); socket.timeout(5000).emit('join-url', urlId, (err, r) => { setLive(!err && r?.success ? 'Connected' : 'Polling'); }); });
    socket.on('click-tick', data => { if (String(data.urlId) !== String(urlId)) return; if (!refreshTimer) refreshTimer = setTimeout(() => { refreshTimer = null; refreshRef.current?.(true); }, 1000); });
    socket.on('connect_error', () => setLive('Polling'));
    socket.on('disconnect', () => setLive('Polling'));
    socket.on('analytics-error', () => { setLive('Polling'); socket.disconnect(); });
    const poll = setInterval(() => { if (!document.hidden) refreshRef.current?.(true); }, 30000);
    const focus = () => { if (!document.hidden) refreshRef.current?.(true); };
    window.addEventListener('focus', focus);
    return () => { clearTimeout(refreshTimer); clearInterval(poll); window.removeEventListener('focus', focus); if (socket.connected) socket.emit('leave-url', urlId); connection.close(); };
  }, [urlId, token]);

  const exportCsv = async () => {
    if (exporting) return; setExporting(true); setExportError('');
    try {
      const res = await API.get(`/analytics/${urlId}/export?range=${range}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = `pburls-${urlId}-${range}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      let msg = err.response?.data?.message;
      if (err.response?.data instanceof Blob) { try { msg = JSON.parse(await err.response.data.text()).message; } catch { /* fallback */ } }
      setExportError(msg || 'Unable to export. Please try again.');
    } finally { setExporting(false); }
  };

  const visible = report?.range === range && report?.id === String(urlId);
  const ov = report?.overview || {};
  const info = report?.info;
  const exportAllowed = report?.subscription?.limits?.csv_export;

  const statCards = [
    { label: 'Total clicks', value: fmt(ov.totalClicks), note: 'All recorded clicks', icon: MousePointer2, accent: '#2d9a5f' },
    { label: 'Unique visitors', value: fmt(ov.uniqueClicks), note: 'Distinct non-bot visitors', icon: Users, accent: '#6c63e0' },
    { label: 'Bot clicks', value: fmt(ov.botClicks), note: 'Automated traffic filtered', icon: Activity, accent: '#f59e42' },
    { label: 'QR scans', value: fmt(ov.qrScans), note: 'Included in total clicks', icon: QrCode, accent: '#3b82f6' },
  ];

  return (
    <WorkspaceShell title="Link analytics" backTo={backTo} backLabel="Back to links">

      {/* ── Page heading ── */}
      <div className="ws-page-heading">
        <div>
          <span className="ws-eyebrow">LINK ANALYTICS</span>
          <h1>Behind every click.</h1>
          <p>Deep engagement insights for this link, within your plan's retention window.</p>
        </div>
        <div className="ws-heading-actions">
          <button type="button" className="ws-button ws-button-secondary ws-back-heading-btn" onClick={() => navigate(backTo)}>
            <ArrowLeft size={15} />Back to links
          </button>
          <div className="an-range-group" role="group" aria-label="Time range">
            {[['24h', '24h'], ['7d', '7 days'], ['30d', '30 days']].map(([id, label]) => (
              <button key={id} className={`an-range-btn${range === id ? ' is-active' : ''}`} onClick={() => setRange(id)}>{label}</button>
            ))}
          </div>
          <button className="ws-icon-button" aria-label="Refresh" disabled={loading || refreshing} onClick={() => load(true)}>
            <RefreshCw size={16} className={refreshing ? 'ws-spin' : ''} />
          </button>
          <button className="ws-button ws-button-secondary" onClick={exportCsv}
            disabled={!exportAllowed || exporting || !visible}
            title={exportAllowed ? 'Download CSV' : 'CSV export requires an eligible plan'}>
            <Download size={15} />{exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="ws-notice ws-error">{error}<button onClick={() => load()}>Retry</button></p>}
      {exportError && <p role="alert" className="ws-notice ws-error">{exportError}</p>}

      {/* ── Link info banner ── */}
      {visible && info && (
        <div className="an-link-banner">
          <div className="an-link-banner-inner">
            <div className="an-link-urls">
              <a href={info.shortUrl} target="_blank" rel="noopener noreferrer" className="an-short-url">
                {info.shortUrl}<ExternalLink size={13} />
              </a>
              <span className="an-long-url" title={info.longUrl}>{info.longUrl}</span>
            </div>
            {ov.period && (
              <span className="an-period">
                {new Date(ov.period.start).toLocaleDateString(undefined, { day:'numeric', month:'short' })}
                {' – '}
                {new Date(ov.period.end).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' })}
                <span className="an-period-note">UTC</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {(loading || (!visible && !error)) && (
        <div className="ws-empty" role="status"><Loader2 size={26} className="ws-spin" /><p>Loading analytics…</p></div>
      )}

      {visible && (<>

        {report.issues.length > 0 && <p className="ws-notice" role="status">{report.issues.join(' ')} Available reports are still shown.</p>}

        {/* ── Stat cards ── */}
        <div className="an-stats">
          {statCards.map(c => <StatCard key={c.label} {...c} />)}
        </div>

        {/* ── Main chart + live feed ── */}
        <div className="an-main-grid">
          <section className="an-card an-chart-card">
            <div className="an-card-head">
              <h3>Click activity</h3>
              <div className="an-chart-legend-inline">
                <span><span className="an-dot" style={{ background: '#2d9a5f' }} />Clicks</span>
                <span><span className="an-dot" style={{ background: '#6c63e0' }} />Unique</span>
              </div>
              <BarChart3 size={17} className="an-card-icon" />
            </div>
            {report.series.some(p => p.clicks > 0) ? (
              <div className="an-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={report.series} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2d9a5f" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#2d9a5f" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gUnique" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6c63e0" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#6c63e0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--ws-line)" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--ws-muted)" fontSize={10} minTickGap={25} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--ws-muted)" fontSize={10} allowDecimals={false} width={36} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Area dataKey="clicks" name="Clicks" stroke="#2d9a5f" fill="url(#gClicks)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    <Area dataKey="unique" name="Unique" stroke="#6c63e0" fill="url(#gUnique)" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="ws-empty"><BarChart3 size={26} /><p>No recorded clicks in this period.</p></div>
            )}
          </section>

          <LiveFeed recentClicks={ov.recentClicks} liveClicks={ov.liveClicks} status={live} />
        </div>

        {/* ── Hourly bar chart (24h only shows hours, others show daily bars) ── */}
        {report.series.some(p => p.clicks > 0) && (
          <section className="an-card an-bar-card">
            <div className="an-card-head"><h3>Click distribution</h3><span className="an-card-sub">Clicks vs unique visitors per bucket</span></div>
            <div className="an-bar-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.series.slice(-20)} margin={{ top: 8, right: 12, left: -20, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid stroke="var(--ws-line)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--ws-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--ws-muted)" fontSize={10} allowDecimals={false} width={36} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="clicks" name="Clicks" fill="#2d9a5f" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="unique" name="Unique" fill="#6c63e0" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ── Audience section heading ── */}
        <div className="an-section-head">
          <span className="ws-eyebrow">AUDIENCE BREAKDOWN</span>
          <h2>Where your clicks come from.</h2>
          <p>Explore geography, devices, and traffic sources for this link.</p>
        </div>

        {/* ── Donut pie row 1: Countries · Devices · Browsers ── */}
        <div className="an-donut-row">
          <DonutChart title="Countries" values={report.geo.countries} nameKey="country"
            locked={report.locked.Geography}
            unavailable={report.issues.some(i => i.startsWith('Geography'))} />
          <DonutChart title="Devices" values={report.devices.devices}
            locked={report.locked.Devices}
            unavailable={report.issues.some(i => i.startsWith('Devices'))} />
          <DonutChart title="Browsers" values={report.devices.browsers}
            locked={report.locked.Devices}
            unavailable={report.issues.some(i => i.startsWith('Devices'))} />
        </div>

        {/* ── Donut pie row 2: OS · Traffic sources · Campaigns ── */}
        <div className="an-donut-row">
          <DonutChart title="Operating systems" values={report.devices.platforms}
            locked={report.locked.Devices}
            unavailable={report.issues.some(i => i.startsWith('Devices'))} />
          <DonutChart title="Referrers" values={report.referrers.referrers} nameKey="host"
            locked={report.locked['Traffic sources']}
            unavailable={report.issues.some(i => i.startsWith('Traffic sources'))} />
          <DonutChart title="UTM campaigns" values={report.referrers.sources} nameKey="source"
            locked={report.locked['Traffic sources']}
            unavailable={report.issues.some(i => i.startsWith('Traffic sources'))} />
        </div>

        {/* ── Ranked tables row ── */}
        <div className="an-table-row">
          <RankTable title="Top countries" rows={report.geo.countries} nameKey="country" icon={Globe}
            locked={report.locked.Geography}
            unavailable={report.issues.some(i => i.startsWith('Geography'))} />
          <RankTable title="Top devices" rows={report.devices.devices} icon={Smartphone}
            locked={report.locked.Devices}
            unavailable={report.issues.some(i => i.startsWith('Devices'))} />
          <RankTable title="Top referrers" rows={report.referrers.referrers} nameKey="host" icon={Monitor}
            locked={report.locked['Traffic sources']}
            unavailable={report.issues.some(i => i.startsWith('Traffic sources'))} />
        </div>

        {/* ── Location explorer ── */}
        <LocationExplorer key={`${urlId}:${range}`} urlId={urlId} range={range}
          locked={report.locked.Geography} refreshKey={ov.period?.end} />

      </>)}

      <p className="ws-footnote" style={{ marginTop: 32 }}>
        Click data processes after the analytics worker handles redirects. Counts refresh every 30 seconds while active.
      </p>
    </WorkspaceShell>
  );
}

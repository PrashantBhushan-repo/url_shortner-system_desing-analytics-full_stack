import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ChevronRight, Globe2, Loader2,
  LockKeyhole, Map, MapPin, RefreshCw, Search, X, RotateCcw
} from 'lucide-react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as topojson from 'topojson-client';
import API from '../../services/urlApi';

/* ─── helpers ──────────────────────────────────────────────────── */
const regions = new Intl.DisplayNames(['en'], { type: 'region' });
const countryName = code => { try { return /^[A-Z]{2}$/.test(code) ? regions.of(code) : code; } catch { return code; } };
const number = value => Number(value || 0).toLocaleString();
const date = value => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const placeName = place => [place.city, place.state, countryName(place.country)].filter(Boolean).join(', ');

/* Map colours ─ pale to vivid green matching the palette */
const MAP_PALETTE = ['#e8f5ee', '#b8dfcc', '#79c4a0', '#3daa76', '#2d9a5f', '#1a7a47', '#0d5c33'];

function getColor(count, max) {
  if (!count || !max) return '#e2e8f0'; // no-data grey
  const ratio = Math.pow(count / max, 0.45); // sqrt-ish scale so small values still show
  const idx = Math.min(MAP_PALETTE.length - 1, Math.floor(ratio * MAP_PALETTE.length));
  return MAP_PALETTE[idx];
}

/* Country code map: TopoJSON uses numeric ISO-3166 codes. We need Alpha-2. */
/* Bundled as a static lookup (top ~250 countries — covers all real traffic). */
const ISO_NUM_TO_A2 = {
  4: 'AF',
  8: 'AL',
  12: 'DZ',
  24: 'AO',
  32: 'AR',
  36: 'AU',
  40: 'AT',
  50: 'BD',
  56: 'BE',
  64: 'BT',
  68: 'BO',
  76: 'BR',
  100: 'BG',
  116: 'KH',
  120: 'CM',
  124: 'CA',
  144: 'LK',
  152: 'CL',
  156: 'CN',
  170: 'CO',
  180: 'CD',
  188: 'CR',
  191: 'HR',
  192: 'CU',
  196: 'CY',
  203: 'CZ',
  208: 'DK',
  214: 'DO',
  218: 'EC',
  818: 'EG',
  222: 'SV',
  231: 'ET',
  246: 'FI',
  250: 'FR',
  266: 'GA',
  276: 'DE',
  288: 'GH',
  300: 'GR',
  320: 'GT',
  324: 'GN',
  340: 'HN',
  348: 'HU',
  356: 'IN',
  360: 'ID',
  364: 'IR',
  368: 'IQ',
  372: 'IE',
  376: 'IL',
  380: 'IT',
  388: 'JM',
  392: 'JP',
  400: 'JO',
  398: 'KZ',
  404: 'KE',
  408: 'KP',
  410: 'KR',
  414: 'KW',
  418: 'LA',
  422: 'LB',
  426: 'LS',
  430: 'LR',
  434: 'LY',
  442: 'LU',
  450: 'MG',
  484: 'MX',
  496: 'MN',
  504: 'MA',
  508: 'MZ',
  516: 'NA',
  524: 'NP',
  528: 'NL',
  554: 'NZ',
  558: 'NI',
  566: 'NG',
  578: 'NO',
  586: 'PK',
  591: 'PA',
  598: 'PG',
  600: 'PY',
  604: 'PE',
  608: 'PH',
  616: 'PL',
  620: 'PT',
  630: 'PR',
  634: 'QA',
  642: 'RO',
  643: 'RU',
  646: 'RW',
  682: 'SA',
  686: 'SN',
  694: 'SL',
  706: 'SO',
  710: 'ZA',
  724: 'ES',
  729: 'SD',
  752: 'SE',
  756: 'CH',
  760: 'SY',
  762: 'TJ',
  764: 'TH',
  792: 'TR',
  800: 'UG',
  804: 'UA',
  784: 'AE',
  826: 'GB',
  840: 'US',
  858: 'UY',
  860: 'UZ',
  862: 'VE',
  704: 'VN',
  887: 'YE',
  894: 'ZM',
  716: 'ZW',
  466: 'ML',
  478: 'MR',
  562: 'NE',
  768: 'TG',
  204: 'BJ',
  854: 'BF',
  174: 'KM',
  262: 'DJ',
  232: 'ER',
  275: 'PS',
  780: 'TT',
  44: 'BS',
  52: 'BB',
  659: 'KN',
  662: 'LC',
  670: 'VC',
  28: 'AG',
  212: 'DM',
  308: 'GD',
  332: 'HT',
  533: 'AW',
  531: 'CW',
  534: 'SX',
  474: 'MQ',
  312: 'GP',
  254: 'GF',
  638: 'RE',
  175: 'YT',
  178: 'CG',
  140: 'CF',
  384: 'CI',
  70: 'BA',
  807: 'MK',
  499: 'ME',
  688: 'RS',
  705: 'SI',
  703: 'SK',
  233: 'EE',
  428: 'LV',
  440: 'LT',
  112: 'BY',
  498: 'MD',
  51: 'AM',
  31: 'AZ',
  268: 'GE',
  417: 'KG',
  795: 'TM',
  96: 'BN',
  458: 'MY',
  702: 'SG',
  626: 'TL',
  512: 'OM',
  344: 'HK',
  446: 'MO',
  158: 'TW',
  242: 'FJ',
  882: 'WS',
  776: 'TO',
  548: 'VU',
  90: 'SB',
  520: 'NR',
  585: 'PW',
  580: 'MP',
  584: 'MH',
  583: 'FM',
  316: 'GU',
  581: 'UM',
  16: 'AS',
  612: 'PN',
  772: 'TK',
  798: 'TV',
};

/* ─── data hooks ────────────────────────────────────────────────── */
function useLocationReport(urlId, range, options, detail, refreshKey, enabled = true) {
  const [result, setResult] = useState({ requestKey: null, data: null, error: '' });
  const key = JSON.stringify(options);
  const requestKey = JSON.stringify([urlId, range, key, detail, refreshKey, enabled]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let current = true;
    const params = new URLSearchParams({ ...JSON.parse(key), range });
    API.get(`/analytics/${urlId}/locations${detail ? '/detail' : ''}?${params}`, { signal: controller.signal }).then(response => {
      if (current) setResult({ requestKey, data: response.data.data, error: '' });
    }).catch(error => {
      if (current && error.code !== 'ERR_CANCELED') setResult({ requestKey, data: null, error: error.response?.data?.message || 'Location data could not be loaded. Please try again.' });
    });
    return () => { current = false; controller.abort(); };
  }, [urlId, range, key, detail, refreshKey, enabled, requestKey]);
  return result.requestKey === requestKey ? { ...result, loading: false } : { data: null, error: '', loading: true };
}

/* ─── GeoJSON loader (fetched once from world-atlas) ─────────── */
let geoJsonCache = null;
let geoJsonPromise = null;

function loadWorldGeoJson() {
  if (geoJsonCache) return Promise.resolve(geoJsonCache);
  if (geoJsonPromise) return geoJsonPromise;
  geoJsonPromise = import('world-atlas/countries-110m.json').then(mod => {
    const topo = mod.default;
    const geo = topojson.feature(topo, topo.objects.countries);
    geoJsonCache = geo;
    return geo;
  });
  return geoJsonPromise;
}

function useWorldGeoJson() {
  const [geo, setGeo] = useState(geoJsonCache);
  useEffect(() => { if (!geo) loadWorldGeoJson().then(setGeo).catch(() => {}); }, [geo]);
  return geo;
}

/* ─── Map reset control ─────────────────────────────────────────── */
function MapResetButton({ onReset }) {
  const map = useMap();
  const handleReset = useCallback(() => {
    map.setView([20, 0], 2);
    onReset?.();
  }, [map, onReset]);
  return (
    <button
      type="button"
      className="loc-map-reset-btn"
      title="Reset map view and clear filter"
      onClick={handleReset}
      aria-label="Reset map view"
    >
      <RotateCcw size={14} />
      Reset
    </button>
  );
}

/* ─── Choropleth world map ───────────────────────────────────────── */
function WorldMap({ clickData, activeCountry, onCountryClick, loading }) {
  const geo = useWorldGeoJson();
  const [tooltip, setTooltip] = useState(null); // { x, y, country, clicks, pct }
  const mapRef = useRef(null);

  /* Build lookup: Alpha-2 → { clicks, pct } */
  const countryStats = useMemo(() => {
    const map = {};
    if (!clickData?.rows) return map;
    const total = clickData.rows.reduce((s, r) => s + (r.clicks || 0), 0);
    for (const row of clickData.rows) {
      if (row.country && row.country !== 'Unknown') {
        map[row.country] = { clicks: row.clicks || 0, pct: total ? ((row.clicks / total) * 100).toFixed(1) : '0.0' };
      }
    }
    return map;
  }, [clickData]);

  const maxClicks = useMemo(() => Math.max(1, ...Object.values(countryStats).map(s => s.clicks)), [countryStats]);

  const styleFeature = useCallback((feature) => {
    const numId = String(feature.id);
    const a2 = ISO_NUM_TO_A2[numId] || ISO_NUM_TO_A2[parseInt(numId)];
    const stat = a2 ? countryStats[a2] : null;
    const isActive = a2 && activeCountry === a2;
    return {
      fillColor: isActive ? '#6c63e0' : getColor(stat?.clicks, maxClicks),
      weight: isActive ? 2 : 0.5,
      opacity: 1,
      color: isActive ? '#6c63e0' : '#fff',
      fillOpacity: isActive ? 0.85 : (stat?.clicks ? 0.8 : 0.45),
    };
  }, [countryStats, maxClicks, activeCountry]);

  const onEachFeature = useCallback((feature, layer) => {
    const numId = String(feature.id);
    const a2 = ISO_NUM_TO_A2[numId] || ISO_NUM_TO_A2[parseInt(numId)];
    const name = a2 ? countryName(a2) : (feature.properties?.name || 'Unknown');
    const stat = a2 ? countryStats[a2] : null;

    layer.on({
      mousemove: (e) => {
        setTooltip({
          x: e.originalEvent.offsetX,
          y: e.originalEvent.offsetY,
          country: name,
          clicks: stat?.clicks || 0,
          pct: stat?.pct || '0.0',
          hasData: !!stat?.clicks,
        });
      },
      mouseout: () => setTooltip(null),
      click: () => { if (a2) onCountryClick?.(a2); },
    });
  }, [countryStats, onCountryClick]);

  /* Re-render GeoJSON when data or active country changes */
  const geoJsonKey = useMemo(
    () => JSON.stringify({ stats: countryStats, active: activeCountry }),
    [countryStats, activeCountry]
  );

  return (
    <div className="loc-map-outer" ref={mapRef}>
      {loading && (
        <div className="loc-map-loading" aria-live="polite">
          <Loader2 size={22} className="ws-spin" />
          <span>Loading location data…</span>
        </div>
      )}
      {tooltip && (
        <div
          className="loc-map-tooltip"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
          aria-hidden="true"
        >
          <strong>{tooltip.country}</strong>
          {tooltip.hasData ? (
            <>
              <span>{number(tooltip.clicks)} clicks</span>
              <span className="loc-tip-pct">{tooltip.pct}% of total</span>
            </>
          ) : (
            <span className="loc-tip-nodata">No clicks in this period</span>
          )}
        </div>
      )}
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={1}
        maxZoom={6}
        style={{ height: '100%', width: '100%', borderRadius: '10px', background: 'var(--ws-soft)' }}
        zoomControl={true}
        attributionControl={false}
        scrollWheelZoom={false}
        worldCopyJump={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />
        {geo && (
          <GeoJSON
            key={geoJsonKey}
            data={geo}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
        {!geo && (
          <div className="loc-map-loading">
            <Loader2 size={18} className="ws-spin" />
          </div>
        )}
        <MapResetButton onReset={() => onCountryClick?.(null)} />
      </MapContainer>

      {/* Legend */}
      <div className="loc-map-legend" aria-label="Map colour scale">
        <span className="loc-legend-label">Fewer clicks</span>
        <div className="loc-legend-gradient">
          {MAP_PALETTE.map(c => <span key={c} style={{ background: c }} />)}
        </div>
        <span className="loc-legend-label">More clicks</span>
      </div>
    </div>
  );
}

/* ─── Pagination ─────────────────────────────────────────────────── */
function Pages({ data, loading, onPage, records = false }) {
  const total = Math.max(1, Math.ceil((data?.totalRows || 0) / (data?.pageSize || 25)));
  return (
    <div className="ws-pagination">
      <span>{number(data?.totalRows)} {records ? (data?.totalRows === 1 ? 'click record' : 'click records') : (data?.totalRows === 1 ? 'location' : 'locations')}</span>
      <div>
        <button type="button" className="ws-icon-button" aria-label="Previous location page" disabled={loading || !data || data.page <= 1} onClick={() => onPage(data.page - 1)}><ArrowLeft size={14} /></button>
        <span>{data?.page || 1} / {total}</span>
        <button type="button" className="ws-icon-button" aria-label="Next location page" disabled={loading || !data || data.page >= total} onClick={() => onPage(data.page + 1)}><ArrowRight size={14} /></button>
      </div>
    </div>
  );
}

/* ─── City detail modal ──────────────────────────────────────────── */
function CityDetail({ place, urlId, range, onClose, refreshKey }) {
  const dialog = useRef(null);
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0);
  const { data, loading, error } = useLocationReport(urlId, range, { country: place.country, state: place.state, city: place.city, page }, true, `${refreshKey || ''}:${retry}`);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return (
    <dialog ref={dialog} className="ws-location-dialog" aria-labelledby="city-detail-title" onCancel={event => { event.preventDefault(); onClose(); }}>
      <header className="ws-location-detail-header">
        <div>
          <span className="ws-eyebrow">LOCATION / CLICK ACTIVITY</span>
          <h2 id="city-detail-title">{place.city === 'Unknown' ? 'Unresolved location' : place.city}</h2>
          <p><MapPin size={14} />{placeName(place)}</p>
        </div>
        <div className="ws-location-detail-actions">
          <button type="button" className="ws-icon-button" aria-label="Refresh city activity" disabled={loading} onClick={() => setRetry(v => v + 1)}><RefreshCw size={16} className={loading ? 'ws-spin' : ''} /></button>
          <button type="button" className="ws-icon-button" aria-label="Close city details" onClick={onClose}><X size={19} /></button>
        </div>
      </header>
      <div className="ws-location-detail-body">
        <p className="ws-location-note">This is an approximate network location. Street addresses and neighborhoods are not collected by this tracker.</p>
        {loading ? (
          <div className="ws-empty" role="status"><Loader2 className="ws-spin" /><p>Loading city activity…</p></div>
        ) : error ? (
          <div className="ws-notice ws-error" role="alert">{error}<button onClick={() => setRetry(v => v + 1)}>Try again</button></div>
        ) : data && (
          <>
            <div className="ws-location-metrics">
              {[['Clicks', data.totalClicks], ['Unique visitors', data.uniqueVisitors], ['QR scans', data.qrScans], ['Bot clicks', data.botClicks]].map(([label, value]) => (
                <div key={label}><span>{label}</span><strong>{number(value)}</strong></div>
              ))}
            </div>
            <div className="ws-location-section-heading">
              <h3>Recorded clicks</h3>
              <span>Newest first · {range === '24h' ? 'Last 24 hours' : range === '7d' ? 'Last 7 days' : 'Last 30 days'}</span>
            </div>
            {!data.rows.length ? (
              <div className="ws-empty"><MapPin /><p>No clicks recorded for this city in this period.</p></div>
            ) : (
              <div className="ws-location-table-wrap">
                <table className="ws-location-table ws-location-events">
                  <caption className="ws-sr-only">Click activity for {placeName(place)}</caption>
                  <thead><tr><th scope="col">Time</th><th scope="col">Reported location</th><th scope="col">Device &amp; software</th><th scope="col">Source</th></tr></thead>
                  <tbody>
                    {data.rows.map(row => (
                      <tr key={row.id}>
                        <td><time dateTime={row.clickedAt}>{date(row.clickedAt)}</time><small>#{row.id}</small></td>
                        <td>{placeName(row)}<small>{row.timezone === 'Unknown' ? 'Timezone unavailable' : row.timezone}</small></td>
                        <td>{row.device}<small>{row.browser} · {row.os}</small></td>
                        <td>{row.referrer}<small>{row.isBot ? 'Detected bot' : 'Browser traffic'}{row.isQrScan ? ' · QR scan' : ''}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pages data={data} loading={loading} onPage={setPage} records />
          </>
        )}
      </div>
    </dialog>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */
export default function LocationExplorer({ urlId, range, locked, refreshKey }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState({});
  const [place, setPlace] = useState(null);
  const [retry, setRetry] = useState(0);
  const [activeTab, setActiveTab] = useState('map'); // 'map' | 'table'

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, loading, error } = useLocationReport(
    urlId, range,
    { search: query, page, ...scope },
    false,
    `${refreshKey || ''}:${retry}`,
    !locked
  );

  const filter = next => { setScope(next); setPage(1); };

  const handleMapCountryClick = useCallback((a2Code) => {
    if (!a2Code) {
      filter({});
    } else {
      filter({ country: a2Code });
      setActiveTab('table'); // auto-switch to table to show filtered results
    }
  }, []);

  return (
    <section className="ws-card ws-location-explorer" aria-labelledby="location-explorer-title">
      {/* Header */}
      <div className="ws-location-heading">
        <div>
          <span className="ws-eyebrow">GEOGRAPHY</span>
          <h2 id="location-explorer-title"><Globe2 size={22} />Where your clicks come from.</h2>
          <p>Interactive world map and drill-down table. Click any country to filter by region.</p>
        </div>
        <span className="ws-badge"><MapPin size={12} />IP-based estimate</span>
      </div>

      {locked ? (
        <div className="ws-empty">
          <LockKeyhole />
          <p>Location analytics is available on an eligible plan.</p>
          <Link to="/pricing" className="ws-button ws-button-secondary">Compare plans</Link>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="ws-location-toolbar">
            <label className="ws-search">
              <Search size={16} />
              <input
                aria-label="Search country, state or city"
                value={search}
                maxLength={100}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search country, state, or city…"
              />
            </label>
            <button type="button" className="ws-icon-button" aria-label="Refresh location analytics" disabled={loading} onClick={() => setRetry(v => v + 1)}>
              <RefreshCw size={15} className={loading ? 'ws-spin' : ''} />
            </button>
            <span>{data ? `${number(data.locatedClicks)} clicks with city data` : loading ? 'Loading locations…' : 'Location data unavailable'}</span>
          </div>

          {/* Tab switcher: Map / Table */}
          <div className="loc-tab-bar" role="tablist" aria-label="Location view">
            <button
              role="tab"
              aria-selected={activeTab === 'map'}
              className={`loc-tab${activeTab === 'map' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('map')}
              id="tab-map"
            >
              <Map size={14} />World Map
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'table'}
              className={`loc-tab${activeTab === 'table' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('table')}
              id="tab-table"
            >
              <Globe2 size={14} />Location Table
            </button>
          </div>

          {/* Breadcrumb filter */}
          <div className="ws-location-breadcrumb" aria-label="Location filters">
            <button type="button" onClick={() => filter({})}>All locations</button>
            {scope.country && (
              <>
                <ChevronRight size={12} />
                <button type="button" onClick={() => filter({ country: scope.country })}>{countryName(scope.country)}</button>
              </>
            )}
            {scope.state && (
              <>
                <ChevronRight size={12} />
                <span>{scope.state}</span>
              </>
            )}
            {(scope.country || scope.state) && (
              <button
                type="button"
                className="loc-clear-filter"
                onClick={() => { filter({}); setSearch(''); setQuery(''); }}
                aria-label="Clear all location filters"
              >
                <X size={11} /> Clear
              </button>
            )}
          </div>

          {/* Map panel */}
          {activeTab === 'map' && (
            <div className="loc-map-panel">
              <WorldMap
                clickData={data}
                activeCountry={scope.country || null}
                onCountryClick={handleMapCountryClick}
                loading={loading}
              />
            </div>
          )}

          {/* Table panel */}
          {activeTab === 'table' && (
            <>
              {loading ? (
                <div className="ws-empty" role="status">
                  <Loader2 className="ws-spin" /><p>Loading location analytics…</p>
                </div>
              ) : error ? (
                <div className="ws-notice ws-error" role="alert">
                  {error}<button onClick={() => setRetry(v => v + 1)}>Try again</button>
                </div>
              ) : !data?.rows.length ? (
                <div className="ws-empty">
                  <MapPin size={26} />
                  <h3>No locations to display.</h3>
                  <p>{query || scope.country ? 'Try another search or clear the location filters.' : 'Locations will appear when public-IP clicks are processed. Local and unresolved traffic stays unknown.'}</p>
                  {(query || scope.country) && (
                    <button className="ws-button ws-button-secondary" onClick={() => { setSearch(''); setQuery(''); filter({}); }}>Clear filters</button>
                  )}
                </div>
              ) : (
                <div className="ws-location-table-wrap">
                  <table className="ws-location-table">
                    <caption className="ws-sr-only">Location analytics for this shortened link</caption>
                    <thead>
                      <tr>
                        <th scope="col">Country</th>
                        <th scope="col">State / region</th>
                        <th scope="col">City</th>
                        <th scope="col" className="ws-number-cell">Clicks</th>
                        <th scope="col" className="ws-number-cell">Unique visitors</th>
                        <th scope="col">Last click</th>
                        <th scope="col"><span className="ws-sr-only">Details</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map(row => (
                        <tr key={JSON.stringify([row.country, row.state, row.city])}>
                          <td>
                            <button type="button" className="ws-table-filter" onClick={() => filter({ country: row.country })}>{countryName(row.country)}</button>
                            <small>{row.country === 'Unknown' ? 'Unresolved' : row.country}</small>
                          </td>
                          <td>
                            <button type="button" className="ws-table-filter" onClick={() => filter({ country: row.country, state: row.state })}>{row.state}</button>
                          </td>
                          <td>
                            <button type="button" className="ws-city-link" onClick={() => setPlace(row)}>{row.city}<ChevronRight size={13} /></button>
                          </td>
                          <td className="ws-number-cell"><strong>{number(row.clicks)}</strong></td>
                          <td className="ws-number-cell">{number(row.uniqueVisitors)}</td>
                          <td><time dateTime={row.lastClick}>{date(row.lastClick)}</time></td>
                          <td>
                            <button type="button" className="ws-icon-button" aria-label={`View clicks in ${placeName(row)}`} onClick={() => setPlace(row)}><ArrowRight size={15} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Pages data={data} loading={loading} onPage={setPage} />
            </>
          )}

          <p className="ws-location-note">IP-based locations are approximate. VPNs and mobile networks can affect accuracy. State and region codes follow the source database. Street addresses are not available.</p>
        </>
      )}
      {place && (
        <CityDetail
          key={JSON.stringify(place)}
          place={place}
          urlId={urlId}
          range={range}
          refreshKey={refreshKey}
          onClose={() => setPlace(null)}
        />
      )}
    </section>
  );
}

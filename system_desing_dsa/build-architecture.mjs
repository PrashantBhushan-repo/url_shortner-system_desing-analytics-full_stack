import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(out);
const app = fs.readFileSync(path.join(root, 'backend/src/app.js'), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from "\.\/routes\/([^"\n]+)"/g)].map(m => [m[1], m[2]]));
const mounts = [...app.matchAll(/app\.use\("([^"]+)", (\w+)\)/g)].filter(m => imports.has(m[2]));
const groups = [];
for (const mount of mounts) {
  const filename = imports.get(mount[2]);
  const source = fs.readFileSync(path.join(root, 'backend/src/routes', filename), 'utf8');
  const routes = [...source.matchAll(/router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]\s*,([^\n]*)/g)].map(m => ({
    method: m[1].toUpperCase(),
    route: mount[1] + (m[2] === '/' ? '' : m[2]),
    declaration: m[3].trim(),
    source: `backend/src/routes/${filename}`,
  }));
  groups.push({name: mount[1], routes});
}
groups.unshift({name:'Direct application routes',routes:[...app.matchAll(/app\.(get|post)\("([^"]+)"\s*,([^\n]*)/g)].map(m=>({method:m[1].toUpperCase(),route:m[2],declaration:m[3].trim(),source:'backend/src/app.js'}))});
const policies = {
  '/api/auth':'Mixed public and JWT routes; OTP, sensitive-action, login, and general rate limits are applied per route. OAuth and options are public. Evaluator bypass depends on configuration.',
  '/api/urls':'Public public-stats; remaining routes require JWT and route-specific ownership. Create enforces quotas; bulk and QR require plan features.',
  '/api/analytics':'JWT plus controller ownership checks; geo/location, devices and export have plan-feature gates. Platform statistics has an additional controller check.',
  '/api/security':'JWT plus general or sensitive-auth rate limits.',
  '/api/api-keys':'JWT + api_access feature; revoke requires ownership.',
  '/api/webhooks':'JWT + webhooks_allowed feature; delete requires ownership. These manage registrations.',
  '/api/teams':'JWT; invite/revoke require OWNER or ADMIN; membership listing requires a matching team role.',
  '/api/domains':'JWT + custom_domain_allowed; verify requires ownership. DNS verification is currently simulated.',
  '/api/admin':'Admin IP boundary + JWT + ADMIN role + admin rate limiter; selected operations add step-up and audit wrappers.',
  '/api/subscription':'JWT + subscription rate limiter; service enforces lifecycle/refund rules.',
  '/api/payments':'active-coupons is public; validate-coupon permits optional auth; checkout/sync routes use JWT and billing rate limits. Mock routes are configuration dependent.',
  '/api/v1/mcp':'info is public; SSE authenticates an API key; messages uses an established in-memory session ID.',
  '/api/mcp':'Alias of /api/v1/mcp. The SSE transport advertises the canonical versioned message endpoint.',
  '/api/assistant':'chat has optional auth; sync requires JWT; action handlers enforce their own user/plan context.',
  'Direct application routes':'/health and /metrics are process/observability endpoints; /api/plans is public; redirect uses rate limiting and code validation. Payment webhook uses raw body and provider signature verification.',
};
let catalog = '# PBUrls — Complete mounted API catalog\n\nGenerated from literal Express declarations by `build-architecture.mjs`. Snapshot: 23 October 2026.\n\n';
catalog += 'Authentication and permission notes are route-family summaries. Handler checks and configuration can further restrict access. The two MCP mounts are listed separately because both paths are exposed. Health/metrics ingress access depends on deployment routing.\n\n';
for (const group of groups) {
  catalog += `## ${group.name}\n\n${policies[group.name]}\n\n| Method | Full path | Source |\n|---|---|---|\n`;
  for (const r of group.routes) catalog += `| ${r.method} | \`${r.route}\` | [${path.basename(r.source)}](../${r.source}) |\n`;
  catalog += '\n';
}
catalog += '## Socket.IO contract\n\n| Direction | Event | Payload / behavior |\n|---|---|---|\n| Client → server | `join-url` | Numeric URL ID; authorized room join, optional acknowledgement |\n| Client → server | `leave-url` | Numeric URL ID; leaves `url:ID` |\n| Server → client | `click-tick` | URL ID, country, device, timestamp |\n| Server → client | `analytics-error` | Room authorization failure message |\n\nHandshake uses `auth.token` or a Bearer Authorization header. Transport path: `/socket.io/`.\n';
fs.writeFileSync(path.join(out, 'PROJECT_API_CATALOG.md'), catalog);

// Vector overview: deliberately resembles the supplied lavender flowchart reference.
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let parts = [];
function label(x,y,lines,cls='label',anchor='middle') {
  const arr = Array.isArray(lines) ? lines : [lines];
  parts.push(`<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${arr.map((line,i)=>`<tspan x="${x}" dy="${i ? 21 : 0}">${esc(line)}</tspan>`).join('')}</text>`);
}
function box(x,y,w,h,lines,type='service') {
  if(type==='store') {
    parts.push(`<path class="store" d="M${x},${y+16} C${x},${y-5} ${x+w},${y-5} ${x+w},${y+16} V${y+h-16} C${x+w},${y+h+5} ${x},${y+h+5} ${x},${y+h-16} Z"/><ellipse class="store" cx="${x+w/2}" cy="${y+16}" rx="${w/2}" ry="16"/>`);
  } else parts.push(`<rect class="${type}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${type==='client'?h/2:3}"/>`);
  label(x+w/2,y+h/2-(lines.length-1)*10+5,lines);
}
function edge(d, text, x,y,dashed=false) {
  parts.push(`<path class="edge${dashed?' async':''}" d="${d}" marker-end="url(#arrow)"/>`);
  if(text) label(x,y,text,'edgeLabel');
}
function lane(y,title,subtitle) {
  parts.push(`<line class="rule" x1="35" y1="${y}" x2="1665" y2="${y}"/>`);
  label(40,y+29,title,'lane','start');
  label(40,y+51,subtitle,'sub','start');
}
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="1700" height="1320" viewBox="0 0 1700 1320" role="img" aria-labelledby="title desc">
<title id="title">PBUrls architecture — current implementation</title><desc id="desc">Flowchart of browser and MCP traffic through NGINX and Express into PostgreSQL and Redis, with asynchronous click processing, realtime analytics, billing recovery and telemetry. Production additions are not part of this diagram.</desc>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#555261"/></marker><filter id="shadow" x="-10%" y="-15%" width="125%" height="145%"><feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="#383044" flood-opacity=".14"/></filter></defs>
<style>text{font-family:Segoe UI,Arial,sans-serif;fill:#27213b}.label{font-size:16px}.edgeLabel{font-size:13px;paint-order:stroke;stroke:#fff;stroke-width:7px;stroke-linejoin:round}.lane{font-size:17px;font-weight:600;fill:#5b39a8}.sub{font-size:13px;fill:#6f697c}.service,.client,.store{fill:#f0eaff;stroke:#a27cf4;stroke-width:1.15;filter:url(#shadow)}ellipse.store{filter:none}.external{fill:#f8f6fc;stroke:#b7afc8;stroke-width:1.15}.edge{stroke:#555261;stroke-width:1.4;fill:none}.async{stroke-dasharray:5 4}.rule{stroke:#e5dfef;stroke-width:1}</style><rect width="1700" height="1320" fill="white"/>`);
label(40,44,'PBUrls · URL shortener architecture','lane','start');
label(40,71,'Implemented modules and request flows  /  source snapshot: 23 October 2026','sub','start');
label(1660,44,'Solid: request / data flow    Dashed: asynchronous event / telemetry','sub','end');
lane(95,'01   Entry, routing, and application modules','The API is one modular Express application. Kubernetes manifests currently declare one API replica.');
box(45,190,155,64,['User / browser'],'client');
box(290,180,185,85,['NGINX edge /','K8s ingress']);
box(575,170,230,100,['Express API :5000','JWT · validation · limits','ownership · plan gates']);
box(290,340,185,80,['React + Vite SPA','served by NGINX']);
box(575,325,230,100,['Links / QR / identity','analytics / billing / teams','domains / keys / admin']);
box(45,350,155,60,['MCP client'],'client');
box(905,180,245,100,['Redis','short:code cache','rate limits / pub-sub'],'store');
box(1290,180,325,100,['PostgreSQL','Url / User / RefreshToken','teams / plans / billing / events'],'store');
box(905,330,245,85,['MCP / assistant','SSE session map','shared services + knowledge']);
box(1290,340,325,75,['SMTP / OAuth providers'],'external');
edge('M200 210H290','GET /r/:shortCode',245,193);
edge('M475 214H575','/api/* + /r/*',525,196);
edge('M382 265V340','UI pages',425,303);
edge('M475 380H520V249H575','REST /api/*',520,305);
edge('M690 270V325','dispatch',730,301);
edge('M805 215H905','cache-aside',855,198);
edge('M1150 230H1290','miss → SQL',1220,212);
edge('M805 375H850V307H1245V250H1290','pg pool + Prisma → same database',1045,303);
edge('M200 380H245V450H1027V415','/api/v1/mcp/sse + /messages',635,445);
edge('M905 370H805',null);
edge('M805 399H850V475H1452V415','email / provider callbacks',1130,470);

lane(510,'02   Redirect and analytics pipeline','Cache lookup → validate active / expiry / password → 302. Analytics is enqueued without awaiting persistence.');
box(45,595,175,80,['Redirect controller','302 → destination']);
box(310,590,210,95,['BullMQ in Redis','click-queue'],'store');
box(620,590,245,95,['Click worker','UA / GeoIP / bot checks','concurrency: 5']);
box(990,590,245,100,['PostgreSQL','Click insert','hourly + daily upserts'],'store');
box(1370,590,245,100,['Redis','daily HLL / minute count','ws:url:ID publication'],'store');
box(990,765,245,80,['API Socket.IO','JWT + authorized URL room']);
box(1370,765,245,80,['React analytics UI','click-tick + REST reports']);
box(620,765,245,80,['Analytics API','owner / feature / retention','raw Click queries + SQL']);
edge('M220 630H310','click event',265,614,true);
edge('M520 630H620','consume',570,614);
edge('M865 630H990','per-event writes',927,613);
edge('M1235 638H1370','counters / publish',1303,620,true);
edge('M1492 690V730H1112V765','subscribe ws:url:*',1290,721,true);
edge('M1235 805H1370','click-tick',1303,786,true);
edge('M1492 845V880H742V845','GET /api/analytics/:urlId/*',1120,873);
edge('M742 765V725H1112V690','query reports',925,716);
label(45,818,['QR embeds ?src=qr','Redis cache failure → DB','Missing code → 404','Inactive / expired → 410'],'sub','start');

lane(915,'03   Billing recovery, scheduled work, and operations','Billing recovery uses PostgreSQL leases and retries. Click, health, and dunning queues use Redis.');
box(45,1000,175,80,['Billing REST module','order / verify / refund']);
box(310,995,210,90,['Razorpay','checkout + gateway API'],'external');
box(620,995,245,100,['PostgreSQL','Payment / WebhookEvent','BillingCheckout / Refund'],'store');
box(990,995,245,100,['BillingRecoveryJob','durable queue in Postgres','leases / retry / review'],'store');
box(1370,995,245,100,['Recovery loop','claim → sync → persist','runs without Redis']);
box(310,1170,210,75,['Scheduled workers','health: every 6 hours','dunning: daily']);
box(620,1170,245,75,['API + worker telemetry','traces / metrics']);
box(990,1170,245,75,['OTel collector → Jaeger','Prometheus / Grafana*'],'external');
edge('M220 1035H310','gateway calls',265,1018);
edge('M520 1035H620','signed webhook*',570,1018);
edge('M865 1035H990','seed recovery',927,1018);
edge('M1235 1035H1370','lease / claim',1303,1018);
edge('M1492 1095V1130H742V1095','update durable outcomes / retry state',1115,1121);
edge('M415 1170V1107H285V1060H310','gateway sync',365,1138);
edge('M865 1206H990','OTLP / scrape',927,1189,true);
label(40,1285,'* Razorpay webhook enters the API before persistence. Prometheus / Grafana use the separate observability configuration.','sub','start');
label(40,1306,'See the companion document for auth, mutation, API catalog, deployment details, implementation limits, and the separately labeled production proposal.','sub','start');
parts.push('</svg>');
const svg = parts.join('\n');
fs.writeFileSync(path.join(out, 'PROJECT_ARCHITECTURE.svg'), svg);

const document = fs.readFileSync(path.join(out, 'PROJECT_ARCHITECTURE.md'), 'utf8');
const routeData = JSON.stringify(groups).replaceAll('<','\\u003c');
const docData = JSON.stringify(document).replaceAll('<','\\u003c');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PBUrls · Architecture and APIs</title>
<style>
:root{font-family:Segoe UI,Arial,sans-serif;color:#29213a;background:#faf9fd;line-height:1.6}*{box-sizing:border-box}body{margin:0}header{padding:32px 5vw 22px;background:#fff;border-bottom:1px solid #e5dfef}header p{margin:4px 0;color:#70677d}h1{font-size:28px;letter-spacing:-.6px;margin:0}nav{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}button{font:inherit;padding:8px 15px;cursor:pointer;border:1px solid #d9cdec;background:#fff;color:#54328d;border-radius:6px}button[aria-selected=true]{background:#efe7ff;border-color:#a27cf4}main{max-width:1600px;padding:28px 4vw 60px;margin:auto}.overview{background:white;border:1px solid #e5dfef;border-radius:8px;overflow:auto}.overview svg{display:block;width:100%;min-width:1050px;height:auto}.note{color:#6b6276;font-size:14px}a{color:#6843ac}article{max-width:1180px;margin:auto;background:white;padding:28px 36px}article h1{font-size:25px}article h2{font-size:22px;border-top:1px solid #e5dfef;padding-top:28px;margin-top:38px}article h3{font-size:18px}table{border-collapse:collapse;width:100%;background:white}th,td{text-align:left;border-bottom:1px solid #e6e0ed;padding:11px 14px;vertical-align:top;font-size:14px}th{background:#f0eaff}code{font-family:Consolas,monospace;font-size:13px;overflow-wrap:anywhere}pre{background:#f6f3fb;padding:16px;overflow:auto;border-radius:5px}.mermaid{background:#fff;overflow:auto;padding:18px 0}.mermaid svg{max-width:none!important;min-width:780px;max-height:1000px}input{font:inherit;padding:10px 14px;max-width:100%;width:600px;border:1px solid #d6cbe6;border-radius:6px;margin:6px 0 20px}.method{color:#6946a0;font-weight:600}#catalog h2{font-size:20px;margin-bottom:4px}#catalog p{margin-top:0;color:#696073;font-size:14px}[hidden]{display:none!important}.table-wrap{overflow:auto}.fallback{white-space:pre-wrap;font-family:Consolas,monospace;font-size:13px}footer{margin:30px 0;color:#70677d;font-size:13px}@media(max-width:700px){header{padding:22px}main{padding:18px 12px}article{padding:18px}.overview svg{min-width:1000px}}@media print{nav,input,.note{display:none}main{padding:0}body{background:white}article{padding:0}.overview{border:0}section[hidden]{display:block!important}.mermaid svg{min-width:0!important;max-width:100%!important}h2{break-after:avoid}table,svg{break-inside:avoid}}
</style></head><body><header><h1>PBUrls · System architecture</h1><p>Project-specific flow diagrams and mounted APIs · 23 October 2026</p><nav role="tablist" aria-label="Architecture views"><button role="tab" aria-controls="overview" id="tab-overview" aria-selected="true">Overview</button><button role="tab" aria-controls="detail" id="tab-detail" aria-selected="false">Detailed flows</button><button role="tab" aria-controls="catalog" id="tab-catalog" aria-selected="false">API catalog</button></nav></header><main>
<section id="overview" role="tabpanel" aria-labelledby="tab-overview"><p class="note">Current implementation. Optional CDN, multi-AZ services, read replicas, and backups are shown separately in Detailed flows.</p><div class="overview">${svg}</div><p class="note">Download: <a href="PROJECT_ARCHITECTURE.svg">vector overview</a> · <a href="PROJECT_ARCHITECTURE.md">editable architecture document</a> · <a href="PROJECT_API_CATALOG.md">API catalog</a></p></section>
<section id="detail" role="tabpanel" aria-labelledby="tab-detail" hidden><p class="note" id="render-note">Detailed diagram rendering loads Mermaid and Markdown libraries from jsDelivr. The SVG overview and API catalog work offline.</p><article id="document"></article></section>
<section id="catalog" role="tabpanel" aria-labelledby="tab-catalog" hidden><label for="route-search">Filter by method, path, or handler</label><br><input id="route-search" type="search" placeholder="e.g. POST, analytics, refund, refresh"><span id="route-count" aria-live="polite"></span><div id="route-groups"></div></section>
<footer>Derived from application routes, active server/worker entry points, schema, and deployment manifests. This is documentation; application code and deployment state are unchanged.</footer></main>
<script>
const groups=${routeData}; const markdown=${docData}; const policies=${JSON.stringify(policies).replaceAll('<','\\u003c')};
const escapeHtml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
document.querySelectorAll('nav button').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-selected',String(b===button)));document.querySelectorAll('main>section').forEach(s=>s.hidden=s.id!==button.getAttribute('aria-controls'));if(button.id==='tab-detail')renderDocument();}));
function renderRoutes(){const query=document.getElementById('route-search').value.toLowerCase();let count=0;document.getElementById('route-groups').innerHTML=groups.map(g=>{const rows=g.routes.filter(r=>(r.method+' '+r.route+' '+r.declaration).toLowerCase().includes(query));count+=rows.length;if(!rows.length)return '';return '<h2>'+escapeHtml(g.name)+'</h2><p>'+escapeHtml(policies[g.name])+'</p><div class="table-wrap"><table><thead><tr><th>Method</th><th>Path</th><th>Source / handler declaration</th></tr></thead><tbody>'+rows.map(r=>'<tr><td class="method">'+r.method+'</td><td><code>'+escapeHtml(r.route)+'</code></td><td><code>'+escapeHtml(r.source)+'</code><br><code>'+escapeHtml(r.declaration)+'</code></td></tr>').join('')+'</tbody></table></div>';}).join('');document.getElementById('route-count').textContent=' '+count+' route declarations';}
document.getElementById('route-search').addEventListener('input',renderRoutes);renderRoutes();
let rendered=false;
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.append(s);});}
async function renderDocument(){if(rendered)return;rendered=true;const target=document.getElementById('document');target.className='fallback';target.textContent=markdown;try{await loadScript('https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js');target.className='';target.innerHTML=marked.parse(markdown);const diagrams=[...target.querySelectorAll('code.language-mermaid')];diagrams.forEach(code=>{const div=document.createElement('div');div.className='mermaid';div.textContent=code.textContent;code.parentElement.replaceWith(div);});const {default:mermaid}=await import('https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs');mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',themeVariables:{primaryColor:'#f0eaff',primaryTextColor:'#29213a',primaryBorderColor:'#a27cf4',lineColor:'#61596d',secondaryColor:'#faf8ff',tertiaryColor:'#fff',fontFamily:'Segoe UI,Arial,sans-serif',fontSize:'15px'},flowchart:{htmlLabels:false,curve:'linear',nodeSpacing:30,rankSpacing:45,useMaxWidth:false}});await mermaid.run({nodes:[...target.querySelectorAll('.mermaid')]});document.getElementById('render-note').textContent='Source-verified flows. The production evolution diagram is a proposal, separate from current deployment.';}catch(error){document.getElementById('render-note').textContent='Diagram library unavailable. Read the source diagrams below, or open PROJECT_ARCHITECTURE.md in a Mermaid-capable Markdown viewer.';console.error(error);}}
</script></body></html>`;
fs.writeFileSync(path.join(out, 'PROJECT_ARCHITECTURE.html'), html);
const routeCount = groups.reduce((n,g)=>n+g.routes.length,0);
console.log(`Generated SVG overview, HTML viewer, and API catalog (${routeCount} mounted route declarations).`);

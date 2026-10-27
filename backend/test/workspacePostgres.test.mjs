import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mock, test } from 'node:test';
import pg from 'pg';
import { config } from '../src/config/config.js';

// Explicitly local only. All fixtures are rolled back, including on assertion failures.
test('local PostgreSQL: two-account link isolation and real analytics queries',async t=>{
  const host=config.db.connectionString?new URL(config.db.connectionString).hostname:config.db.host;
  if(!['localhost','127.0.0.1','::1'].includes(host)){t.skip('Refusing to write fixtures to a non-local database');return;}
  const client=new pg.Client(config.db.connectionString?{connectionString:config.db.connectionString,connectionTimeoutMillis:3000}:{host:config.db.host,port:config.db.port,database:config.db.name,user:config.db.user,password:config.db.password,connectionTimeoutMillis:3000});
  try {await client.connect();}catch(error){t.skip(`Local PostgreSQL unavailable (${error.code||'connection error'})`);return;}
  try {
    await client.query('BEGIN');
    let pending=Promise.resolve();
    const query=(...args)=>{const result=pending.then(()=>client.query(...args));pending=result.catch(()=>{});return result;};
    mock.module('../src/config/db.js',{defaultExport:{query}});
    class PrismaClient {
      $queryRaw(strings,...values){return query(strings.map((part,index)=>part+(index<values.length?'$'+(index+1):'')).join(''),values).then(result=>result.rows);}
      click={count:async({where})=>Number((await query('SELECT COUNT(*) FROM "Click" WHERE url_id=$1 AND clicked_at >= $2 AND clicked_at <= $3',[where.url_id,where.clicked_at.gte,where.clicked_at.lte])).rows[0].count),findMany:async({where})=>(await query('SELECT country,device_type,clicked_at FROM "Click" WHERE url_id=$1 AND clicked_at >= $2 AND clicked_at <= $3 ORDER BY clicked_at DESC LIMIT 10',[where.url_id,where.clicked_at.gte,where.clicked_at.lte])).rows};
    }
    mock.module('../src/generated/prisma/index.js',{namedExports:{PrismaClient}});
    mock.module('../src/config/prismaClient.js',{defaultExport:new PrismaClient()});
    const repository=await import('../src/repositories/url.repository.js');
    const analytics=await import('../src/services/analytics.service.js');
    const owner=randomUUID(),other=randomUUID(),suffix=randomUUID().slice(0,8);
    await client.query('INSERT INTO "User" (id,name,email,role) VALUES ($1,$2,$3,$4),($5,$6,$7,$4)',[owner,'Workspace QA A',`qa-a-${suffix}@example.com`,'USER',other,'Workspace QA B',`qa-b-${suffix}@example.com`]);
    const a=await repository.createUrl('https://example.com/qa-a',`QAa${suffix}`,false,null,owner);
    const b=await repository.createUrl('https://example.com/qa-b',`QAb${suffix}`,false,null,other);
    for(const [visitor,bot,scan] of [['visitor-a',false,false],['visitor-a',false,true],['bot-a',true,false]])await client.query('INSERT INTO "Click" (url_id,visitor_id,clicked_at,is_bot,is_qr_scan) VALUES ($1,$2,$3,$4,$5)',[a.id,visitor,new Date(Date.now()-3600000),bot,scan]);
    const own=await repository.listUrlsForUser(owner,'USER');assert.ok(own.some(row=>row.id===a.id));assert.ok(!own.some(row=>row.id===b.id));
    const adminPersonal=await repository.listUrlsForUser(owner,'ADMIN');assert.ok(!adminPersonal.some(row=>row.id===b.id));
    assert.equal(await repository.findByShortCodeForUser(a.short_code,other,'USER'),undefined);
    const overview=await analytics.getUrlOverview(String(a.id),'24h');assert.equal(overview.totalClicks,3);assert.equal(overview.uniqueClicks,1);assert.equal(overview.botClicks,1);assert.equal(overview.qrScans,1);
    const series=await analytics.getUrlTimeseries(String(a.id),'24h');assert.equal(series.reduce((sum,bucket)=>sum+bucket.clicks,0),3);assert.ok(series.length>=24);
    const isolated=await analytics.getUrlOverview(String(b.id),'24h');assert.equal(isolated.totalClicks,0);
    const {getLocationReport,locationQuery}=await import('../src/services/locationAnalytics.service.js');
    const geo=await repository.createUrl('https://example.com/geo-qa',`QAg${suffix}`,false,null,owner);
    const stamp=new Date(Date.now()-3600000);
    for(let i=0;i<26;i++)await client.query('INSERT INTO "Click" (url_id,visitor_id,clicked_at,country,state,city,is_bot,is_qr_scan,browser,operating_system) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[geo.id,`visitor-${i%3}`,stamp,'US','IL','Springfield',i===0,i===1,'Chrome','Windows']);
    for(const [country,state,city] of [['US','MA','Springfield'],['IN','MH','Pune'],['IN','MH','Pune'],[null,null,null]])await client.query('INSERT INTO "Click" (url_id,visitor_id,clicked_at,country,state,city) VALUES ($1,$2,$3,$4,$5,$6)',[geo.id,'other-visitor',stamp,country,state,city]);
    await client.query('INSERT INTO "Click" (url_id,visitor_id,clicked_at,country,state,city) VALUES ($1,$2,$3,$4,$5,$6)',[b.id,'other-account',stamp,'US','IL','Springfield']);
    const places=await getLocationReport(String(geo.id),'24h',null,locationQuery({}));
    assert.equal(places.totalClicks,30);assert.equal(places.totalRows,4);assert.equal(places.locatedClicks,29);
    const namedCountry=await getLocationReport(String(geo.id),'24h',null,locationQuery({search:'India'}));assert.equal(namedCountry.totalClicks,2);
    const cityOptions=locationQuery({country:'US',state:'IL',city:'Springfield'},true);
    const detail=await getLocationReport(String(geo.id),'24h',null,cityOptions,true);
    assert.equal(detail.totalClicks,26);assert.equal(detail.rows.length,25);assert.equal(detail.uniqueVisitors,3);assert.equal(detail.qrScans,1);assert.equal(detail.botClicks,1);
    assert.ok(detail.rows.every(row=>row.state==='IL'&&row.city==='Springfield'));
    assert.ok(detail.rows.every(row=>!('ip_address' in row)&&!('latitude' in row)&&!('visitor_id' in row)));
    const next=await getLocationReport(String(geo.id),'24h',null,{...cityOptions,page:2},true);assert.equal(next.rows.length,1);assert.ok(!detail.rows.some(row=>row.id===next.rows[0].id));
    const retained=await getLocationReport(String(geo.id),'24h',new Date(),locationQuery({}));assert.equal(retained.totalClicks,0);
  } finally {await client.query('ROLLBACK');await client.end();}
});

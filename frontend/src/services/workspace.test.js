import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeLink, upsertLink, linkStatus, visibleLinks, trackedQrUrl, localDateTime } from "./linkModel.js";
import { loadLinkReport } from "./analyticsApi.js";

test("editing an alias replaces the record by immutable ID", () => {
  const previous=normalizeLink({id:'1',shortCode:'oldcode',longUrl:'https://example.com',createdAt:'2026-10-01',clicksCount:12});
  const links=upsertLink([previous],{...previous,shortCode:'newcode',shortUrl:'https://short.example/newcode'});
  assert.equal(links.length,1);assert.equal(links[0].shortCode,'newcode');assert.equal(previous.shortCode,'oldcode');
});

test("status and search do not mislabel expired or unchecked links", () => {
  const links=[normalizeLink({id:'1',longUrl:'https://example.com/alpha',isActive:true,expiresAt:'2020-01-01',clicksCount:'12'}),normalizeLink({id:'2',shortCode:'beta',longUrl:'https://example.com/beta',isActive:true,expiresAt:null,clicksCount:3})];
  assert.equal(linkStatus(links[0]),'Expired');assert.equal(linkStatus(links[1]),'Active');
  assert.equal(links[1].lastCheckedAt,null);
  assert.equal(visibleLinks(links,' ALPHA ','Expired')[0].id,'1');assert.equal(visibleLinks(links,'alpha','Active').length,0);
  assert.equal(visibleLinks(links,'','All','clicks')[0].id,'1');
});

test("plan-restricted reports do not hide basic analytics", async () => {
  const api={get:async path=>{
    if(path.includes('/geo')||path.includes('/devices'))throw {response:{status:403,data:{code:'PLAN_LIMIT'}}};
    return {data:{data:path.includes('/overview')?{totalClicks:12}:path.includes('/id/')?{id:'1',longUrl:'https://example.com'}:path.includes('/timeseries')?[]:path==='/subscription'?{limits:{csv_export:false}}:{referrers:[],sources:[]}}};
  }};
  const report=await loadLinkReport(api,'1','7d');
  assert.equal(report.overview.totalClicks,12);assert.equal(report.locked.Geography,true);assert.equal(report.locked.Devices,true);assert.equal(report.issues.length,0);
});

test("an unauthorized link stops report loading before secondary requests", async () => {
  let calls=0;
  await assert.rejects(loadLinkReport({get:async()=>{calls++;throw {response:{status:404}};}},'2','7d'));
  assert.equal(calls,1);
});

test("optional service failures remain distinguishable from empty data", async () => {
  const report=await loadLinkReport({get:async path=>{
    if(path.includes('/timeseries'))throw new Error('offline');
    return {data:{data:path.includes('/overview')?{totalClicks:5}:undefined}};
  }},'1','24h');
  assert.equal(report.overview.totalClicks,5);assert.deepEqual(report.series,[]);assert.ok(report.issues.includes('Click activity could not be loaded.'));
});

test("QR destinations preserve existing parameters and mark scans for analytics", () => {
  const destination=new URL(trackedQrUrl('https://example.com/r/abc1234?campaign=launch'));
  assert.equal(destination.searchParams.get('src'),'qr');
  assert.equal(destination.searchParams.get('campaign'),'launch');
  const time=new Date('2026-10-21T08:00:00Z');
  assert.equal(new Date(localDateTime(time)).getTime(),time.getTime());
});

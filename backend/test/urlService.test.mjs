import assert from "node:assert/strict";
import { mock, test } from "node:test";

let cached=null, record=null, updates=null, gating=null, invalidated=[];
const row={id:1n,user_id:'owner',long_url:'https://example.com',short_code:'oldcode',is_active:true,custom_alias:true,expires_at:new Date('2030-01-01'),created_at:new Date('2026-01-01'),clicks_count:9};
mock.module('../src/repositories/url.repository.js',{namedExports:{
  createUrl:async(long,code,alias,expires,user)=>({...row,long_url:long,short_code:code,custom_alias:alias,expires_at:expires,user_id:user}),
  findByShortCode:async()=>record,
  findByShortCodeForUser:async(_code,user)=>user==='owner'?row:null,
  shortCodeExists:async()=>false,
  updateUrl:async(...args)=>{updates=args;return {...row,long_url:args[1],short_code:args[2],expires_at:args[4]};},
  deactivateUrl:async()=>true,listUrlsForUser:async()=>[],findById:async()=>record,
}});
mock.module('../src/services/cache.service.js',{namedExports:{getCachedUrl:async()=>cached,setCachedUrl:async(_code,value)=>{cached=value;},invalidateCache:async code=>invalidated.push(code)}});
mock.module('../src/services/planLimitService.js',{namedExports:{validateUrlGating:async(_id,params)=>{gating=params;return {expiresAt:params.expiresAt??new Date('2027-01-01')};}}});
mock.module('../src/config/config.js',{namedExports:{config:{baseUrl:'https://short.example'}}});
const service=await import('../src/services/url.service.js');

test('cached redirects still expire; legacy cache cannot skip database validation',async()=>{
  cached={id:'1',longUrl:'https://example.com',isActive:true,expiresAt:'2020-01-01'};
  await assert.rejects(service.getOriginalUrl('oldcode'),error=>error.statusCode===410);
  cached={longUrl:'https://example.com'};record={...row,is_active:false};
  await assert.rejects(service.getOriginalUrl('oldcode'),error=>error.statusCode===410);
  cached=null;record=row;
  await service.getOriginalUrl('oldcode');
  assert.equal(cached.isActive,true);assert.equal(cached.expiresAt,row.expires_at);
});

test('editing only a destination preserves expiry and does not gate an unchanged alias',async()=>{
  invalidated=[];
  await service.updateShortUrl('oldcode',{longUrl:'https://example.com/new'},{id:'owner',role:'USER'});
  assert.equal(updates[1],'https://example.com/new');
  assert.equal(updates[4],row.expires_at);
  assert.equal(gating.customAlias,null);
  assert.equal(gating.expiresAt,undefined);
  assert.deepEqual(invalidated,['oldcode']);
});

test('link mutations cannot look up another user’s record',async()=>{
  await assert.rejects(service.updateShortUrl('oldcode',{longUrl:'https://example.com/new'},{id:'other',role:'USER'}),error=>error.statusCode===404);
});

test('new links return the stored owner record and a seven-character generated code',async()=>{
  const result=await service.shortenUrl('https://example.com/new',null,null,{id:'owner'});
  assert.match(result.shortCode,/^[A-Za-z0-9]{7}$/);
  assert.equal(result.longUrl,'https://example.com/new');assert.equal(result.id,'1');
  assert.equal(result.shortUrl,`https://short.example/r/${result.shortCode}`);
});

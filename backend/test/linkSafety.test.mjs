import assert from "node:assert/strict";
import { test } from "node:test";
import { generateShortCode, insertWithUniqueCode } from "../src/utils/generateShortCode.js";
import { assertUrlAccess } from "../src/utils/urlAccess.js";
import { createSocketAuthorization } from "../src/utils/socketAuthorization.js";
import { analyticsWindow, fillTimeBuckets } from "../src/utils/analyticsWindow.js";

test("generated codes are seven URL-safe Base62 characters", () => {
  for (let index=0; index<2000; index++) assert.match(generateShortCode(), /^[0-9A-Za-z]{7}$/);
  for (const invalid of [0,-1,1.5,65,NaN,"7"]) assert.throws(() => generateShortCode(invalid), RangeError);
});

test("database collisions retry without a race-prone pre-check", async () => {
  let calls=0;
  const codes=["aaaaaaa","bbbbbbb","ccccccc"];
  const result=await insertWithUniqueCode(async code => { calls++; if(calls<3)throw Object.assign(new Error('collision'),{code:'23505',constraint:'Url_short_code_key'}); return {shortCode:code}; },()=>codes.shift());
  assert.equal(result.shortCode,'ccccccc'); assert.equal(calls,3);
  const unrelated=Object.assign(new Error('other unique constraint'),{code:'23505',constraint:'different_unique_key'});
  await assert.rejects(insertWithUniqueCode(async()=>{throw unrelated;}), error=>error===unrelated);
  let failures=0;
  await assert.rejects(insertWithUniqueCode(async()=>{failures++;throw Object.assign(new Error('collision'),{code:'23505'});}),error=>error.statusCode===503);
  assert.equal(failures,5);
});

test("HTTP and socket access reject other users and missing owners", async () => {
  const findUrl=async id=>id===1n?{id,user_id:'account-a'}:null;
  assert.equal((await assertUrlAccess('1',{id:'account-a',role:'USER'},findUrl)).user_id,'account-a');
  await assert.rejects(assertUrlAccess('1',{id:'account-b',role:'USER'},findUrl),error=>error.statusCode===404);
  await assert.rejects(assertUrlAccess('2',{id:'admin',role:'ADMIN'},findUrl),error=>error.statusCode===404);
  for(const id of ['abc','0','-1','1.5','999999999999999999999']) await assert.rejects(assertUrlAccess(id,{id:'account-a'},findUrl),error=>error.statusCode===400);
  const access=createSocketAuthorization({verifyToken:()=>({userId:'account-b',role:'ADMIN',tokenVersion:0}),findUser:async()=>({id:'account-b',role:'USER',status:'ACTIVE',tokenVersion:0}),findUrl});
  await assert.rejects(access.authorizeRoom('token','1'),error=>error.statusCode===404);
});

test("revoked and suspended socket sessions cannot join rooms", async () => {
  for(const user of [{id:'account-a',role:'USER',status:'SUSPENDED',tokenVersion:0},{id:'account-a',role:'USER',status:'ACTIVE',tokenVersion:2}]) {
    let reads=0;
    const access=createSocketAuthorization({verifyToken:()=>({userId:'account-a',tokenVersion:0}),findUser:async()=>user,findUrl:async()=>{reads++;return {user_id:'account-a'};}});
    await assert.rejects(access.authorizeRoom('token','1'));
    assert.equal(reads,0);
  }
});

test("analytics windows preserve partial days, zero buckets, and retention boundaries", () => {
  const now=new Date('2026-10-21T12:34:00Z');
  const {start,end}=analyticsWindow('24h',null,now);
  assert.equal(end-start,86400000);
  const cutoff=new Date('2026-10-21T00:00:00Z');
  assert.equal(analyticsWindow('30d',cutoff,now).start.toISOString(),cutoff.toISOString());
  const result=fillTimeBuckets([{bucket:new Date('2026-10-21T12:00:00Z'),clicks:3n,unique:2n,bots:1n}],'24h',start,end);
  assert.equal(result.length,25);
  assert.equal(result[0].clicks,0);
  assert.equal(result.at(-1).clicks,3);
  assert.equal(result.at(-1).unique,2);
});

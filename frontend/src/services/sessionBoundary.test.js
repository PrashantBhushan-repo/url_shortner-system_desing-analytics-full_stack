import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';

test('a refresh started by the previous account cannot restore its token or replay requests after account switching',async()=>{
  const stored=new Map();
  globalThis.window={localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},dispatchEvent:()=>{}};
  const {default:API,resetAuthSession,getAccessToken}=await import('./urlApi.js');
  const oldApiAdapter=API.defaults.adapter,oldAdapter=axios.defaults.adapter;
  let releaseRefresh,notifyStarted,calls=0;
  const started=new Promise(resolve=>{notifyStarted=resolve;});
  axios.defaults.adapter=async config=>{notifyStarted();return new Promise(resolve=>{releaseRefresh=()=>resolve({status:200,statusText:'OK',config,headers:{},data:{data:{accessToken:'old-account-refreshed'}}});});};
  API.defaults.adapter=async config=>{calls++;throw {config,response:{status:401}};};
  try {
    resetAuthSession('old-account');
    const pending=API.get('/urls/me').catch(error=>error);
    await started;
    resetAuthSession('new-account');
    releaseRefresh();
    await pending;
    assert.equal(getAccessToken(),'new-account');
    assert.equal(calls,1);

    let releaseSuccess, startedSuccess;
    const successStarted = new Promise(resolve => { startedSuccess = resolve; });
    API.defaults.adapter = config => { startedSuccess(); return new Promise(resolve => { releaseSuccess = () => resolve({status:200,statusText:'OK',headers:{},config,data:{privateData:'previous-account-only'}}); }); };
    resetAuthSession('previous-account');
    const previousResult = API.get('/urls/me').catch(error => error);
    await successStarted;
    resetAuthSession('current-account');
    releaseSuccess();
    const blockedResponse = await previousResult;
    assert.equal(blockedResponse.code,'ERR_CANCELED');
    assert.equal(blockedResponse.data,undefined);
  } finally {API.defaults.adapter=oldApiAdapter;axios.defaults.adapter=oldAdapter;delete globalThis.window;}
});

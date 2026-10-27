// Isolated billing UI preview. All data and provider outcomes are fictional and in memory.
// Never imported by the production application; no backend, bank, or mail requests are made.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const user = { id: 'billing-qa-user', name: 'Alex Morgan', email: 'alex@example.invalid', role: 'USER' };
const auth = `const user=${JSON.stringify(user)};const noop=()=>{};const session={user,token:'billing-qa',loading:false,logout:async()=>{},login:noop,setUser:noop};export const useAuth=()=>session;export const AuthProvider=({children})=>children;`;
const api = `const request=async(method,path,body,config={})=>{const response=await fetch('/__billing_qa'+path,{method,signal:config.signal,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.message),{response:{data,status:response.status}});return {data}};export const getAccessToken=()=> 'billing-qa';export const setAccessToken=()=>{};export const resetAuthSession=()=>{};export default {get:(p,c)=>request('GET',p,null,c),post:(p,b,c)=>request('POST',p,b,c),put:(p,b,c)=>request('PUT',p,b,c),patch:(p,b,c)=>request('PATCH',p,b,c),delete:(p,c)=>request('DELETE',p,null,c)};`;
const baseLimit = { max_urls: 100, team_members_allowed: 3, analytics_retention_days: 90, custom_alias_allowed: true, custom_domain_allowed: true, qr_code_allowed: true, password_protected_links: true, api_access: true, csv_export: true, webhooks_allowed: true };
const plans = [{ id: 'free-plan', key: 'free', name: 'Free', description: 'A thoughtful start for your first links.', price_monthly: 0, currency: 'INR', limit: { ...baseLimit, max_urls: 10, team_members_allowed: 0, analytics_retention_days: 7 } }, ...[['starter', 'Starter', 9900, 'Everything you need to build momentum.'], ['pro','Pro',29900,'Powerful links for ambitious creators and growing teams.'],['business','Business',79900,'More capacity and control for your entire organization.']].map(([key,name,price,description],index) => ({ id: key+'-plan', key, name, description, currency: 'INR', price_monthly: price, price_quarterly: price*2.7, price_yearly: price*10, limit: { ...baseLimit, max_urls: [100,1000,null][index], team_members_allowed: [3,10,null][index], analytics_retention_days: [30,90,365][index], priority_support: index === 2 } }))];
let scenario = 'paid', profile, subscription, records, coupon, selectedPlan, selectedCycle;
const deadline = days => new Date(Date.now() + days * 86400000).toISOString();
function reset(name) {
  scenario = name; coupon = null;
  profile = { name: user.name, email: user.email, company: 'Northstar Studio', address: '42 Creative Avenue', city: 'Pune', region: 'Maharashtra', postal_code: '411001', country: 'IN', tax_id: '' };
  subscription = { id: 'qa-sub', billingCycle: 'MONTHLY', status: 'ACTIVE', startedAt: deadline(-5), currentPeriodEnd: deadline(25), cancelAtPeriodEnd: name === 'canceled' };
  records = Array.from({ length: 13 }, (_, index) => ({ id: 'qa-receipt-'+(index+1), subscription_id: 'qa-sub', amount: 29900, refunded_amount: index === 4 ? 29900 : index === 5 ? 5000 : 0, currency: 'INR', billing_cycle: 'MONTHLY', gateway: 'razorpay', gateway_order_id: 'order_QA_'+String(1300-index), gateway_payment_id: 'pay_QA_'+index, status: ['CAPTURED','AUTHORIZED','FAILED','CREATED','REFUNDED','PARTIALLY_REFUNDED'][index%6], created_at: deadline(-index-1), plan: { key:'pro',name:'Pro' }, billingProfile: profile, refund: name === 'refund-pending' && index === 0 ? {id:'qa-refund',status:'PENDING',amount:29900,created_at:deadline(-1)} : null, refundEligibility: { eligible: index === 0 || index === 6, deadline: deadline(12-index), amount: 29900, reason: 'Only captured payments within the refund window are eligible.' } }));
  if (name === 'free' || name === 'empty') { records = []; profile = null; }
  if (name === 'refund-pending') records[0].refundEligibility.eligible = false;
}
reset('paid');
async function body(req) { const chunks=[]; for await (const chunk of req) chunks.push(chunk); return chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}; }
const server = await createServer({ root, plugins: [{ name:'billing-qa-only', enforce:'pre',
  resolveId(source) { if (/context\/AuthContext(?:\.jsx)?$/.test(source)) return '\0billing-auth'; if (/services\/urlApi(?:\.js)?$/.test(source) || source === './urlApi' || source === './urlApi.js') return '\0billing-api'; },
  load(id) { if(id==='\0billing-auth')return auth; if(id==='\0billing-api')return api; },
  configureServer(server) { server.middlewares.use(async (req,res,next) => {
    if (!req.url.startsWith('/__billing_qa')) return next();
    const url = new URL(req.url.replace('/__billing_qa','') || '/', 'http://qa.invalid'); const path=url.pathname;
    const send = (data,status=200) => { res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data)); };
    const ok = (data,message) => send({success:true,data,message});
    if (path === '/scenario') { reset(url.searchParams.get('name') || 'paid'); return ok({scenario}); }
    if (path === '/auth/profile') return ok(user);
    if (path === '/subscription') {
      if(scenario==='load-error')return send({message:'Billing is temporarily unavailable.'},503);
      return ok({subscription,plan:scenario==='free'||scenario==='empty'?plans[0]:plans.find(p=>p.key===(selectedPlan||'pro')),limits:scenario==='zero-limit'?{...baseLimit,max_urls:0}:plans[2].limit,usage:{urlsCount:scenario==='over-limit'?1200:742,teamMembersCount:4,customDomainsCount:2,webhooksCount:3},billing:{configured:scenario!=='unconfigured',mode:'ONE_TIME',refundWindowDays:14,checkouts:[]}});
    }
    if (path === '/plans') return ok(plans);
    if (path === '/subscription/billing-profile') { if(req.method==='PUT'){profile=await body(req);return ok(profile,'Billing details saved.');}return ok(profile); }
    if (path === '/payments/active-coupons') return ok([{id:'qa-coupon',code:'NEXTCHAPTER',discount_type:'PERCENT',discount_value:20,description:'A little room to grow.'}]);
    if (path === '/subscription/invoices') {
      if(scenario==='history-error')return send({message:'Could not load payment records.'},503);
      let rows=records.filter(row=>(url.searchParams.get('status')==='ALL'||!url.searchParams.get('status')||row.status===url.searchParams.get('status'))&&JSON.stringify(row).toLowerCase().includes((url.searchParams.get('search')||'').toLowerCase()));
      const page=Number(url.searchParams.get('page')||1);return send({success:true,data:rows.slice((page-1)*10,page*10),pagination:{page,pages:Math.ceil(rows.length/10),total:rows.length,pageSize:10}});
    }
    if (path === '/subscription/cancel' || path === '/subscription/resume') { subscription.cancelAtPeriodEnd=path.endsWith('cancel');return ok(subscription,'Plan preference updated.'); }
    if (path === '/payments/validate-coupon') { const input=await body(req);if(!['NEXTCHAPTER','FREE100'].includes(input.couponCode))return send({message:'This coupon is invalid or expired.'},400);coupon={code:input.couponCode,discountType:'PERCENT',discountValue:input.couponCode==='FREE100'?100:20,applicablePlans:[]};return ok(coupon); }
    if (path === '/payments/create-order') { const input=await body(req);selectedPlan=input.planKey;selectedCycle=input.billingCycle;if(scenario==='checkout-error')return send({message:'A payment is already awaiting confirmation.'},409);return send({success:true,zeroCharge:input.couponCode==='FREE100',data:{paymentId:'qa-new-payment',orderId:'order_QA_new',keyId:'qa-inert',amount:input.couponCode==='FREE100'?0:29900,currency:'INR',status:input.couponCode==='FREE100'?'CAPTURED':'CREATED'}}); }
    if (path === '/payments/verify') { if(scenario==='verify-error')return send({message:'Provider confirmation is delayed.'},409);subscription.billingCycle=selectedCycle;return ok({status:scenario==='authorized'?'AUTHORIZED':'CAPTURED'}); }
    if (path === '/subscription/refund-request') { const input=await body(req);if(scenario==='refund-error')return send({message:'The provider result is pending. Refresh refund status.'},409);const record=records.find(p=>p.id===input.paymentId);record.refund={id:'qa-refund',amount:record.amount,status:'PENDING',created_at:new Date().toISOString()};record.refundEligibility.eligible=false;return send({success:true,data:record.refund,message:'Your refund request is recorded and awaiting provider confirmation.'},202); }
    if(path.includes('/refund-sync')){records.filter(r=>r.refund).forEach(r=>{r.refund.status='PROCESSED';r.status='REFUNDED';r.refunded_amount=r.amount;});return ok({status:'PROCESSED'},'Refund status refreshed.');}
    if(path.match(/^\/payments\/.+\/sync$/))return ok({},'Payment status refreshed.');
    return ok([]);
  }); },
}], server:{host:'127.0.0.1',port:5233,strictPort:true} });
await server.listen();console.log('Isolated billing preview: http://127.0.0.1:5233/settings?tab=subscription');

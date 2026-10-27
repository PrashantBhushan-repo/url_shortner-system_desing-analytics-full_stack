// Isolated browser QA: real frontend and AuthContext, fictional HTTP responses.
// This server never proxies a request to the application backend or a bank.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const limit = { max_urls: 100, analytics_retention_days: 30, team_members_allowed: 3, custom_alias_allowed: true, custom_domain_allowed: true, qr_code_allowed: true, password_protected_links: true, geo_analytics: true, api_access: true, csv_export: true, webhooks_allowed: true };
const plans = [['free','Free',0],['starter','Starter',9900],['pro','Pro',29900],['business','Business',79900]].map(([key,name,price],index) => ({ id: key, key, name, price_monthly: price, price_quarterly: price*3, price_yearly: price*10, currency: 'INR', description: ['Your first links and insights.','A focused toolkit for independent work.','More capacity for growing teams.','Control and capacity for your organization.'][index], limit: { ...limit, max_urls: [10,100,1000,null][index], analytics_retention_days: [7,30,90,365][index] } }));
const requests = [];
async function body(req) { const chunks = []; for await(const chunk of req) chunks.push(chunk); return chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}; }
const server = await createServer({ root, plugins: [{ name:'navigation-qa-only', enforce:'pre',
  resolveId(source) { if (source === 'socket.io-client') return '\0navigation-socket'; },
  load(id) { if(id === '\0navigation-socket') return 'export const io=()=>({on(){return this},emit(){},off(){},disconnect(){}});'; },
  configureServer(vite) { vite.middlewares.use(async (req,res,next) => {
    if (!req.url.startsWith('/api/') && !req.url.startsWith('/__navigation_qa') && !req.url.startsWith('/r/')) return next();
    const url = new URL(req.url, 'http://qa.invalid');
    const send = (data,status=200) => { res.statusCode=status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); };
    const ok = data => send({success:true,data});
    if (url.pathname.startsWith('/r/')) return ok({testGateway:true,hasPassword:url.searchParams.has('password')});
    if(url.pathname==='/__navigation_qa/session') { res.setHeader('Set-Cookie','qa_role='+url.searchParams.get('role')+'; Path=/; SameSite=Lax');return ok({}); }
    if(url.pathname==='/__navigation_qa/requests') return ok(requests);
    const role = /qa_role=(user|admin)/.exec(req.headers.cookie || '')?.[1];
    const user = { id:'navigation-qa-user', name:'Sam Morgan', email:'sam@example.invalid', role:role==='admin'?'ADMIN':'USER', emailVerified:true, twoFactorEnabled:false };
    const path = url.pathname.replace(/^\/api/,'');
    requests.push({method:req.method,path});
    if (path === '/auth/options') return ok({providers:[]});
    if (path === '/auth/refresh') return role ? ok({accessToken:'navigation-qa-session'}) : send({message:'Sign in required'},401);
    if (path === '/auth/login') { await body(req);res.setHeader('Set-Cookie','qa_role=user; Path=/; SameSite=Lax');return ok({accessToken:'navigation-qa-session'}); }
    if (path === '/auth/logout') {res.setHeader('Set-Cookie','qa_role=guest; Path=/; SameSite=Lax');return ok({});}
    if (path === '/plans') return ok(plans);
    if (path === '/payments/active-coupons') return ok([{id:'qa-coupon',code:'GROW20',description:'Sandbox offer',discount_type:'PERCENT',discount_value:20}]);
    if (!role) return send({message:'Sign in required'},401);
    if (path === '/auth/profile') return ok(user);
    if (path === '/subscription') return ok({subscription:{id:'qa-sub',status:'ACTIVE',billingCycle:'MONTHLY',startedAt:new Date().toISOString(),currentPeriodEnd:new Date(Date.now()+86400000*25).toISOString()},plan:{key:'pro',name:'Pro',currency:'INR'},limits:plans[2].limit,usage:{urlsCount:12,teamMembersCount:2,customDomainsCount:1,webhooksCount:0},billing:{configured:true,purchaseId:'qa-last-payment',checkouts:[],mode:'ONE_TIME'}});
    if (path === '/subscription/billing-profile') return ok({name:user.name,email:user.email,country:'IN'});
    if (path === '/subscription/invoices') return send({success:true,data:[],pagination:{page:1,pages:0,total:0}});
    if (path === '/urls') return send({success:true,data:[],pagination:{page:1,totalPages:0,total:0},meta:{}});
    if (path === '/auth/security/sessions' || path.includes('history')) return ok([]);
    if (path === '/admin/billing/recovery') return ok({jobs:[],reviews:[],unprocessedWebhooks:0,lastActivity:null});
    if (path.includes('/overview')) return ok({totalUsers:24,totalUrls:85,totalClicks:1360,totalRevenue:149500,usersByPlan:[],recentUsers:[]});
    if (path.startsWith('/admin')) return send({success:true,data:[],pagination:{page:1,totalPages:0,total:0}});
    return ok([]);
  }); },
}], server:{host:'127.0.0.1',port:5234,strictPort:true,proxy:{'/api':undefined,'/socket.io':undefined,'/r/':undefined}} });
await server.listen(); console.log('Isolated navigation QA: http://127.0.0.1:5234');

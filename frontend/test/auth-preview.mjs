// Isolated authentication UI fixtures. No backend requests, mail, real credentials or accounts.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const auth = `import {createContext,useContext,useState,createElement} from 'react';const Context=createContext(null);export function AuthProvider({children}){const [token,setToken]=useState(null);const user=token?{id:'qa-user',name:'QA Sample',role:'USER'}:null;return createElement(Context.Provider,{value:{token,user,loading:false,login:setToken,logout:()=>setToken(null)}},children);}export const useAuth=()=>useContext(Context);`;
const api = `
const id='12345678-1234-4234-8234-123456789abc';
const response=data=>({data:{success:true,data}});
const invalid=()=>{throw {response:{status:400,data:{message:'Invalid or expired verification code.'}}};};
export const setAccessToken=()=>{};export const getAccessToken=()=>null;export const resetAuthSession=()=>{};
export default {
get:async path=>response(path==='/auth/options'?{providers:[]}:path==='/urls/me'?[]:path==='/subscription'?{plan:{name:'Free'},limits:{}}:{}),
post:async(path,payload)=>{
 await new Promise(resolve=>setTimeout(resolve,50));
 if(path==='/auth/register')return response({userId:id});
 if(path==='/auth/login')return response(payload.email.startsWith('totp')?{twoFactorRequired:true,userId:id}:{otpRequired:true,userId:id});
 if(path==='/auth/verify-email'){if(payload.otp!=='123456')invalid();return response({});}
 if(path==='/auth/verify-login-otp'){if(!['123456','abcdef-123456'].includes(payload.otp))invalid();return response({accessToken:'qa-inert-session'});}
 if(path==='/auth/resend-otp')return response({});
 if(path==='/auth/forgot-password')return response({userId:id});
 if(path==='/auth/reset-password'){if(payload.otp!=='123456')invalid();return response({});}
 return response({});
 }};`;
const server = await createServer({root,plugins:[{name:'auth-qa-fixtures',enforce:'pre',resolveId(source){if(/context\/AuthContext(?:\.jsx)?$/.test(source))return '\0auth-qa.jsx';if(/services\/urlApi(?:\.js)?$/.test(source)||source==='./urlApi')return '\0auth-api';},load(id){if(id==='\0auth-qa.jsx')return auth;if(id==='\0auth-api')return api;}}],server:{host:'127.0.0.1',port:5232,strictPort:true}});
await server.listen();
console.log('Authentication QA: http://127.0.0.1:5232/auth (in-memory sample data only)');

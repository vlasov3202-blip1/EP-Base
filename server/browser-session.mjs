import crypto from 'node:crypto';
import {getPlatformRuntimeForTests} from './http-api.mjs';

const SESSION_COOKIE='eineiro_session';
const CSRF_COOKIE='eineiro_csrf';

export function parseCookies(header=''){
  const out={};for(const part of String(header).split(';')){const i=part.indexOf('=');if(i<0)continue;const k=part.slice(0,i).trim();const v=part.slice(i+1).trim();if(k)out[k]=decodeURIComponent(v)}return out;
}
export function serializeCookie(name,value,{httpOnly=false,maxAge=null,sameSite='Lax',secure=false,path='/'}={}){
  const parts=[`${name}=${encodeURIComponent(value)}`,`Path=${path}`,`SameSite=${sameSite}`];if(httpOnly)parts.push('HttpOnly');if(secure)parts.push('Secure');if(maxAge!=null)parts.push(`Max-Age=${Math.max(0,Math.floor(maxAge))}`);return parts.join('; ');
}
function json(res,status,payload,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(status===204?'':JSON.stringify(payload));}
async function body(req,{maxBytes=200_000}={}){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>maxBytes)throw Object.assign(new Error('payload too large'),{status:413});chunks.push(c)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}
function secureCookies(){return process.env.COOKIE_SECURE==='true'||process.env.NODE_ENV==='production'}
function csrfOk(req,cookies){const sent=String(req.headers['x-csrf-token']||'');return Boolean(sent&&cookies[CSRF_COOKIE]&&crypto.timingSafeEqual(Buffer.from(sent),Buffer.from(cookies[CSRF_COOKIE])))}

export async function handleBrowserSession(req,res){
  const url=new URL(req.url,'http://local');
  const cookies=parseCookies(req.headers.cookie||'');
  if(req.method==='POST'&&url.pathname==='/api/browser/login'){
    try{const {auth}=await getPlatformRuntimeForTests();const p=await body(req);const out=await auth.login(p);const csrf=crypto.randomBytes(24).toString('base64url');const maxAge=Math.max(1,Math.floor((Date.parse(out.session.expiresAt)-Date.now())/1000));const cookieHeaders=[serializeCookie(SESSION_COOKIE,out.token,{httpOnly:true,maxAge,secure:secureCookies()}),serializeCookie(CSRF_COOKIE,csrf,{httpOnly:false,maxAge,secure:secureCookies()})];return json(res,200,{user:out.user,companyId:out.session.companyId,role:out.session.role,csrfToken:csrf},{'Set-Cookie':cookieHeaders});}catch(e){return json(res,e.status||401,{error:e.message,code:e.code||'LOGIN_ERROR'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/browser/logout'){
    const token=cookies[SESSION_COOKIE];if(token){const {auth}=await getPlatformRuntimeForTests();await auth.logout(token).catch(()=>{});}return json(res,204,{}, {'Set-Cookie':[serializeCookie(SESSION_COOKIE,'',{httpOnly:true,maxAge:0,secure:secureCookies()}),serializeCookie(CSRF_COOKIE,'',{maxAge:0,secure:secureCookies()})]});
  }
  const token=cookies[SESSION_COOKIE];
  if(!token)return false;
  if(!req.headers.authorization)req.headers.authorization=`Bearer ${token}`;
  if(!['GET','HEAD','OPTIONS'].includes(req.method||'GET')&&!csrfOk(req,cookies))return json(res,403,{error:'csrf token required',code:'CSRF_REQUIRED'});
  return false;
}

export {SESSION_COOKIE,CSRF_COOKIE};

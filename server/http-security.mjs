import crypto from 'node:crypto';
import net from 'node:net';

const DEFAULT_MAX_BODY_BYTES=1_000_000;
const DEFAULT_MAX_JSON_DEPTH=24;
const DEFAULT_MAX_JSON_NODES=20_000;

export class FixedWindowRateLimiter{
  constructor({now=()=>Date.now(),maxEntries=50_000}={}){this.now=now;this.maxEntries=maxEntries;this.buckets=new Map();}
  consume(key,{limit,windowMs}={}){
    const safeLimit=Math.max(1,Number(limit)||1);const safeWindow=Math.max(1000,Number(windowMs)||60_000);const now=this.now();
    let bucket=this.buckets.get(String(key));
    if(!bucket||now-bucket.startedAt>=safeWindow)bucket={startedAt:now,count:0};
    bucket.count++;this.buckets.set(String(key),bucket);
    if(this.buckets.size>this.maxEntries)this.prune(now,safeWindow);
    if(bucket.count>safeLimit)throw Object.assign(new Error('rate limit exceeded'),{status:429,code:'RATE_LIMITED',retryAfterMs:Math.max(1,safeWindow-(now-bucket.startedAt))});
    return{limit:safeLimit,remaining:Math.max(0,safeLimit-bucket.count),resetAt:bucket.startedAt+safeWindow};
  }
  clear(key){this.buckets.delete(String(key));}
  prune(now=this.now(),maxWindowMs=86_400_000){for(const [key,bucket]of this.buckets)if(now-bucket.startedAt>=maxWindowMs)this.buckets.delete(key);}
}

export const applicationRateLimiter=new FixedWindowRateLimiter();

export function clientAddress(req){
  const direct=String(req.socket?.remoteAddress||req.connection?.remoteAddress||'unknown');
  if(process.env.TRUST_PROXY!=='true')return direct;
  const forwarded=String(req.headers?.['x-forwarded-for']||'').split(',')[0].trim();
  return net.isIP(forwarded)?forwarded:direct;
}

export async function enforceRateLimit(req,{scope,limit,windowMs,key=null,limiter=applicationRateLimiter}={}){
  const subject=key||clientAddress(req);
  return await limiter.consume(`${scope||'request'}:${subject}`,{limit,windowMs});
}

export async function readJsonBody(req,{maxBytes=DEFAULT_MAX_BODY_BYTES,maxDepth=DEFAULT_MAX_JSON_DEPTH,maxNodes=DEFAULT_MAX_JSON_NODES}={}){
  const declared=Number(req.headers?.['content-length']||0);
  if(Number.isFinite(declared)&&declared>maxBytes)throw codedError('payload too large','PAYLOAD_TOO_LARGE',413);
  let size=0;const chunks=[];
  for await(const chunk of req){
    size+=chunk.length;
    if(size>maxBytes)throw codedError('payload too large','PAYLOAD_TOO_LARGE',413);
    chunks.push(chunk);
  }
  let value;
  try{value=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
  catch{throw codedError('invalid JSON','INVALID_JSON',400);}
  assertJsonComplexity(value,{maxDepth,maxNodes});
  return value;
}

export function assertJsonComplexity(value,{maxDepth=DEFAULT_MAX_JSON_DEPTH,maxNodes=DEFAULT_MAX_JSON_NODES}={}){
  const stack=[{value,depth:0}];let nodes=0;
  while(stack.length){
    const current=stack.pop();nodes++;
    if(nodes>maxNodes)throw codedError('JSON structure is too large','JSON_TOO_COMPLEX',413);
    if(current.depth>maxDepth)throw codedError('JSON structure is too deep','JSON_TOO_DEEP',413);
    if(!current.value||typeof current.value!=='object')continue;
    for(const [key,child]of Object.entries(current.value)){
      if(['__proto__','prototype','constructor'].includes(key))throw codedError('unsafe JSON key','UNSAFE_JSON_KEY',400);
      stack.push({value:child,depth:current.depth+1});
    }
  }
}

export function installSecurityHeaders(req,res){
  const requestId=crypto.randomUUID();
  const original=res.writeHead.bind(res);
  res.writeHead=(statusCode,headers={})=>original(statusCode,{...securityHeaders(),...headers,'X-Request-Id':requestId});
  req.securityRequestId=requestId;
  return requestId;
}

export function securityHeaders(){
  const headers={
    'Content-Security-Policy':"default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; manifest-src 'self'",
    'Cross-Origin-Opener-Policy':'same-origin',
    'Cross-Origin-Resource-Policy':'same-origin',
    'Permissions-Policy':'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()',
    'Referrer-Policy':'strict-origin-when-cross-origin',
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY'
  };
  if(process.env.NODE_ENV==='production')headers['Strict-Transport-Security']='max-age=31536000; includeSubDomains';
  return headers;
}

export function rejectOversizedDeclaredBody(req,res,{maxBytes=Number(process.env.EINEIRO_HTTP_MAX_BODY_BYTES||14_000_000)}={}){
  const declared=Number(req.headers?.['content-length']||0);
  if(Number.isFinite(declared)&&declared>maxBytes){
    res.writeHead(413,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify({error:'payload too large',code:'PAYLOAD_TOO_LARGE'}));
    return true;
  }
  return false;
}

function codedError(message,code,status){return Object.assign(new Error(message),{code,status});}

import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {parseCookies,serializeCookie,SESSION_COOKIE,CSRF_COOKIE,handleBrowserSession} from './browser-session.mjs';

const parsed=parseCookies('a=1; eineiro_session=abc%20123; eineiro_csrf=xyz');
assert.equal(parsed[SESSION_COOKIE],'abc 123');assert.equal(parsed[CSRF_COOKIE],'xyz');
const sessionCookie=serializeCookie(SESSION_COOKIE,'token',{httpOnly:true,maxAge:3600,secure:true});
assert.ok(sessionCookie.includes('HttpOnly'));assert.ok(sessionCookie.includes('SameSite=Lax'));assert.ok(sessionCookie.includes('Secure'));assert.ok(sessionCookie.includes('Max-Age=3600'));
const csrfCookie=serializeCookie(CSRF_COOKIE,'csrf',{maxAge:3600});assert.equal(csrfCookie.includes('HttpOnly'),false);

function req(payload){const raw=Buffer.from(JSON.stringify(payload));const r=Readable.from([raw]);r.method='POST';r.url='/api/auth/register';r.headers={};return r}
function res(){const chunks=[];const w=new Writable({write(c,_e,cb){chunks.push(Buffer.from(c));cb()}});w.statusCode=200;w.writeHead=s=>{w.statusCode=s};const end=w.end.bind(w);w.end=c=>{if(c)chunks.push(Buffer.from(c));return end()};w.payload=()=>JSON.parse(Buffer.concat(chunks).toString('utf8'));return w}
const response=res();
await handleBrowserSession(req({companyId:'victim-company',userId:'attacker',email:`audit-${Date.now()}@test.local`,password:'password123',role:'admin'}),response);
await new Promise(r=>response.on('finish',r));
const registration=response.payload();
assert.equal(response.statusCode,201);
assert.notEqual(registration.companyId,'victim-company');
assert.equal(registration.role,'owner');
assert.equal(registration.user.role,'owner');
assert.notEqual(registration.user.role,'admin');

console.log('EINEIRO browser session tests: OK');

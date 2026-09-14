import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {handleBrowserSession,parseCookies,serializeCookie,SESSION_COOKIE,CSRF_COOKIE} from './browser-session.mjs';

const parsed=parseCookies('a=1; eineiro_session=abc%20123; eineiro_csrf=xyz');
assert.equal(parsed[SESSION_COOKIE],'abc 123');assert.equal(parsed[CSRF_COOKIE],'xyz');
const sessionCookie=serializeCookie(SESSION_COOKIE,'token',{httpOnly:true,maxAge:3600,secure:true});
assert.ok(sessionCookie.includes('HttpOnly'));assert.ok(sessionCookie.includes('SameSite=Lax'));assert.ok(sessionCookie.includes('Secure'));assert.ok(sessionCookie.includes('Max-Age=3600'));
const csrfCookie=serializeCookie(CSRF_COOKIE,'csrf',{maxAge:3600});assert.equal(csrfCookie.includes('HttpOnly'),false);
assert.ok(sessionCookie.includes('Path=/'));
const req=Readable.from([]);req.method='POST';req.url='/api/browser/logout';req.headers={cookie:`${SESSION_COOKIE}=stolen; ${CSRF_COOKIE}=expected`};
const chunks=[];const res=new Writable({write(chunk,_encoding,callback){chunks.push(Buffer.from(chunk));callback()}});res.writeHead=status=>{res.statusCode=status};const end=res.end.bind(res);res.end=chunk=>{if(chunk)chunks.push(Buffer.from(chunk));return end()};
await handleBrowserSession(req,res);await new Promise(resolve=>res.on('finish',resolve));
assert.equal(res.statusCode,403);assert.equal(JSON.parse(Buffer.concat(chunks).toString()).code,'CSRF_REQUIRED');
console.log('EINEIRO browser session tests: OK');

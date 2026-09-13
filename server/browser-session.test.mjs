import assert from 'node:assert/strict';
import {parseCookies,serializeCookie,SESSION_COOKIE,CSRF_COOKIE} from './browser-session.mjs';

const parsed=parseCookies('a=1; eineiro_session=abc%20123; eineiro_csrf=xyz');
assert.equal(parsed[SESSION_COOKIE],'abc 123');assert.equal(parsed[CSRF_COOKIE],'xyz');
const sessionCookie=serializeCookie(SESSION_COOKIE,'token',{httpOnly:true,maxAge:3600,secure:true});
assert.ok(sessionCookie.includes('HttpOnly'));assert.ok(sessionCookie.includes('SameSite=Lax'));assert.ok(sessionCookie.includes('Secure'));assert.ok(sessionCookie.includes('Max-Age=3600'));
const csrfCookie=serializeCookie(CSRF_COOKIE,'csrf',{maxAge:3600});assert.equal(csrfCookie.includes('HttpOnly'),false);
console.log('EINEIRO browser session tests: OK');

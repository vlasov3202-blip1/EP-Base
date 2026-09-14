import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [js,css,html]=await Promise.all([readFile('market.js','utf8'),readFile('market-auth.css','utf8'),readFile('index.html','utf8')]);
for(const form of ['login','register','reset-request','reset-confirm'])assert.ok(js.includes(`data-auth-form=\"${form}\"`));
for(const endpoint of ['/api/browser/login','/api/browser/logout','/api/auth/register','/api/v1/auth/email/verify','/api/v1/auth/password/reset','/api/v1/auth/password/reset/confirm','/api/v1/auth/sessions'])assert.ok(js.includes(endpoint),`missing auth endpoint: ${endpoint}`);
assert.ok(js.includes("credentials:'include'"));assert.ok(js.includes("'X-CSRF-Token':csrf()"));assert.ok(js.includes("replaceAll('\"','&quot;')"));
assert.equal(js.includes('localStorage.setItem(\'auth'),false);assert.equal(js.includes('sessionStorage.setItem(\'auth'),false);
assert.ok(css.includes('.market-auth-card'));assert.ok(css.includes('.market-session'));assert.ok(html.includes('market-auth.css'));
console.log('EINEIRO Market auth UI contract tests: OK');

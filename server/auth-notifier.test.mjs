import assert from 'node:assert/strict';
import {AuthWebhookNotifier,createAuthNotifierFromEnv} from './auth-notifier.mjs';

assert.throws(()=>createAuthNotifierFromEnv({EINEIRO_AUTH_NOTIFIER_REQUIRED:'true'}),error=>error.code==='AUTH_NOTIFIER_REQUIRED');
assert.throws(()=>new AuthWebhookNotifier({url:'http://notify.local',production:true}),error=>error.code==='AUTH_NOTIFIER_TLS_REQUIRED');
let request=null;const notifier=new AuthWebhookNotifier({url:'https://notify.example.test/auth',token:'secret-ref-value',fetchImpl:async(url,options)=>{request={url,options};return{ok:true};},production:true});await notifier.notify({type:'EMAIL_VERIFY',email:'buyer@example.com',token:'one-time-token',expiresAt:'2026-09-15T00:00:00Z'});assert.equal(request.url,'https://notify.example.test/auth');assert.equal(request.options.headers.Authorization,'Bearer secret-ref-value');assert.equal(JSON.parse(request.options.body).token,'one-time-token');
console.log('EINEIRO auth notifier tests: OK');

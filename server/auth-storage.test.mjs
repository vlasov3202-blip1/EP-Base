import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {JsonFileStore,CURRENT_SCHEMA_VERSION,migrateDatabase} from './storage.mjs';
import {AuthService,hashPassword,tokenHash,verifyPassword} from './auth.mjs';

const dir=await mkdtemp(path.join(os.tmpdir(),'eineiro-'));
const file=path.join(dir,'db.json');
try{
  const migrated=migrateDatabase({});
  assert.equal(migrated.meta.schemaVersion,CURRENT_SCHEMA_VERSION);
  assert.deepEqual(migrated.records,{});
  assert.deepEqual(migrated.sessions,{});
  assert.deepEqual(migrated.authAccounts,{});

  const password=hashPassword('supersecret');
  assert.equal(verifyPassword('supersecret',password),true);
  assert.equal(verifyPassword('wrong-password',password),false);

  const store=await new JsonFileStore(file).init();
  const deliveries=[];const auth=new AuthService(store,{sessionTtlMs:60000,notifier:async message=>deliveries.push(message)});
  await auth.register({companyId:'c1',userId:'u1',email:'Owner@Example.com',password:'supersecret',role:'owner'});
  await auth.register({companyId:'c2',userId:'u2',email:'Owner@Example.com',password:'another-secret',role:'owner'});
  assert.equal(store.findUserByEmail('c1','owner@example.com').id,'u1');
  assert.equal(store.findUserByEmail('c2','owner@example.com').id,'u2');

  const login=await auth.login({companyId:'c1',email:'owner@example.com',password:'supersecret'});
  assert.ok(login.token.length>20);
  assert.equal(store.getSession(login.token),null);
  assert.ok(store.getSession(tokenHash(login.token)));
  assert.equal('id' in login.session,false);
  const ctx=await auth.authenticate(login.token);
  assert.equal(ctx.companyId,'c1');
  assert.equal(ctx.role,'owner');
  assert.doesNotThrow(()=>auth.require(ctx,'finance.read'));
  assert.throws(()=>auth.requireRecentReauthentication(ctx),error=>error.code==='REAUTH_REQUIRED'&&error.status===428);
  await assert.rejects(()=>auth.reauthenticate(login.token,{password:'wrong-password',requestIp:'127.0.0.1'}),error=>error.code==='REAUTH_FAILED');
  const reauth=await auth.reauthenticate(login.token,{password:'supersecret',requestIp:'127.0.0.1'});assert.ok(reauth.validUntil);
  const steppedUp=await auth.authenticate(login.token);assert.equal(steppedUp.reauthenticatedAt,reauth.reauthenticatedAt);assert.doesNotThrow(()=>auth.requireRecentReauthentication(steppedUp));

  const buyer=await auth.registerPublic({companyId:'injected',userId:'root',role:'admin',email:'buyer@example.com',password:'buyer-secret',name:'Buyer'});
  assert.equal(buyer.companyId,null);assert.equal(buyer.role,'buyer');assert.equal(buyer.id,buyer.identityId);assert.equal('passwordHash' in buyer,false);
  assert.equal(store.findUserByEmail('injected','buyer@example.com'),null);
  assert.equal(deliveries.at(-1).type,'EMAIL_VERIFY');
  await assert.rejects(()=>auth.login({email:'buyer@example.com',password:'buyer-secret'}),error=>error.code==='EMAIL_VERIFICATION_REQUIRED');
  const verified=await auth.verifyEmail(deliveries.at(-1).token);assert.equal(verified.emailStatus,'verified');
  await assert.rejects(()=>auth.verifyEmail(deliveries.at(-1).token),error=>error.code==='INVALID_OR_EXPIRED_TOKEN');
  const buyerLogin=await auth.login({email:'buyer@example.com',password:'buyer-secret'});assert.equal(buyerLogin.session.companyId,null);assert.equal(buyerLogin.user.role,'buyer');
  const buyerCtx=await auth.authenticate(buyerLogin.token);assert.equal(buyerCtx.companyId,null);assert.equal(buyerCtx.role,'buyer');
  assert.equal((await auth.listSessions(buyer.identityId)).length,1);
  await auth.requestPasswordReset({email:'unknown@example.com'});assert.notEqual(deliveries.at(-1).email,'unknown@example.com');
  await auth.requestPasswordReset({email:'buyer@example.com'});const resetToken=deliveries.at(-1).token;
  await auth.resetPassword({token:resetToken,password:'buyer-secret-new'});
  await assert.rejects(()=>auth.authenticate(buyerLogin.token),/invalid session/);
  assert.ok((await auth.login({email:'buyer@example.com',password:'buyer-secret-new'})).token);

  const repo1=store.tenant({companyId:'c1'}),repo2=store.tenant({companyId:'c2'});
  await repo1.put('Product',{id:'p1',name:'Tenant A'});
  await repo2.put('Product',{id:'p1',name:'Tenant B'});
  assert.equal(repo1.get('Product','p1').name,'Tenant A');
  assert.equal(repo2.get('Product','p1').name,'Tenant B');

  const storeReloaded=await new JsonFileStore(file).init();
  assert.equal(storeReloaded.tenant({companyId:'c1'}).get('Product','p1').name,'Tenant A');
  assert.equal(storeReloaded.getUser('c1','u1').email,'owner@example.com');
  const raw=JSON.parse(await readFile(file,'utf8'));
  assert.equal(raw.meta.schemaVersion,CURRENT_SCHEMA_VERSION);

  await auth.logout(login.token);
  await assert.rejects(()=>auth.authenticate(login.token),/invalid session/);

  let now=1000;const protectedAuth=new AuthService(store,{now:()=>now,maxIdentityFailures:2,maxIpFailures:10,loginWindowMs:1000});
  await assert.rejects(()=>protectedAuth.login({companyId:'c1',email:'owner@example.com',password:'wrong-one',requestIp:'127.0.0.1'}),/invalid credentials/);
  await assert.rejects(()=>protectedAuth.login({companyId:'c1',email:'owner@example.com',password:'wrong-two',requestIp:'127.0.0.1'}),/invalid credentials/);
  await assert.rejects(()=>protectedAuth.login({companyId:'c1',email:'owner@example.com',password:'supersecret',requestIp:'127.0.0.1'}),error=>error.code==='LOGIN_RATE_LIMITED'&&error.status===429);
  now=2001;assert.ok((await protectedAuth.login({companyId:'c1',email:'owner@example.com',password:'supersecret',requestIp:'127.0.0.1'})).token);

  console.log('EINEIRO auth/storage tests: OK');
} finally {
  await rm(dir,{recursive:true,force:true});
}

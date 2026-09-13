import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {JsonFileStore,CURRENT_SCHEMA_VERSION,migrateDatabase} from './storage.mjs';
import {AuthService,hashPassword,verifyPassword} from './auth.mjs';

const dir=await mkdtemp(path.join(os.tmpdir(),'eineiro-'));
const file=path.join(dir,'db.json');
try{
  const migrated=migrateDatabase({});
  assert.equal(migrated.meta.schemaVersion,CURRENT_SCHEMA_VERSION);
  assert.deepEqual(migrated.records,{});
  assert.deepEqual(migrated.sessions,{});

  const password=hashPassword('supersecret');
  assert.equal(verifyPassword('supersecret',password),true);
  assert.equal(verifyPassword('wrong-password',password),false);

  const store=await new JsonFileStore(file).init();
  const auth=new AuthService(store,{sessionTtlMs:60000});
  await auth.register({companyId:'c1',userId:'u1',email:'Owner@Example.com',password:'supersecret',role:'owner'});
  await auth.register({companyId:'c2',userId:'u2',email:'Owner@Example.com',password:'another-secret',role:'owner'});
  assert.equal(store.findUserByEmail('c1','owner@example.com').id,'u1');
  assert.equal(store.findUserByEmail('c2','owner@example.com').id,'u2');

  const login=await auth.login({companyId:'c1',email:'owner@example.com',password:'supersecret'});
  assert.ok(login.token.length>20);
  const ctx=await auth.authenticate(login.token);
  assert.equal(ctx.companyId,'c1');
  assert.equal(ctx.role,'owner');
  assert.doesNotThrow(()=>auth.require(ctx,'finance.read'));

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

  console.log('EINEIRO auth/storage tests: OK');
} finally {
  await rm(dir,{recursive:true,force:true});
}

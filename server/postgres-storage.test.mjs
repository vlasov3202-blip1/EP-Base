import assert from 'node:assert/strict';
import {migratePostgres,PostgresStore,PostgresTenantRepository} from './postgres-storage.mjs';

class FakePool{
  constructor(){this.calls=[];this.responses=[];}
  push(rows=[]){this.responses.push({rows});}
  async query(sql,params=[]){this.calls.push({sql:String(sql),params});if(String(sql).startsWith('SELECT version'))return this.responses.shift()||{rows:[]};if(String(sql).startsWith('SELECT data'))return this.responses.shift()||{rows:[]};return{rows:[]};}
}

const migrationPool=new FakePool();
await migratePostgres(migrationPool);
assert.equal(migrationPool.calls[0].sql,'BEGIN');
assert.ok(migrationPool.calls.some(x=>x.sql.includes('CREATE TABLE IF NOT EXISTS eineiro_records')));
assert.ok(migrationPool.calls.some(x=>x.sql.startsWith('INSERT INTO eineiro_schema_migrations')));
assert.equal(migrationPool.calls.at(-1).sql,'COMMIT');

const pool=new FakePool();
const repoA=new PostgresTenantRepository(pool,'company-a');
const repoB=new PostgresTenantRepository(pool,'company-b');
await repoA.put('Product',{id:'same',name:'A'});
await repoB.put('Product',{id:'same',name:'B'});
const puts=pool.calls.filter(x=>x.sql.includes('INSERT INTO eineiro_records'));
assert.equal(puts[0].params[0],'company-a');
assert.equal(puts[1].params[0],'company-b');
assert.equal(puts[0].params[2],'same');
assert.equal(puts[1].params[2],'same');

pool.push([{data:{id:'p1',companyId:'company-a'}}]);
const found=await repoA.get('Product','p1');
assert.equal(found.companyId,'company-a');
const getCall=pool.calls.find(x=>x.sql.startsWith('SELECT data FROM eineiro_records WHERE company_id'));
assert.deepEqual(getCall.params,['company-a','Product','p1']);

const store=new PostgresStore(pool);
pool.push([{data:{id:'k1',companyId:'company-a',hash:'x'}}]);
const keys=await store.listAllApiKeys();
assert.equal(keys[0].id,'k1');

console.log('EINEIRO PostgreSQL storage tests: OK');

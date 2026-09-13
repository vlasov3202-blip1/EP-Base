import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {JsonFileStore} from './storage.mjs';
import {CompanyBackupService} from './company-backup.mjs';

const dir=await mkdtemp(path.join(os.tmpdir(),'eineiro-company-backup-'));
const store=await new JsonFileStore(path.join(dir,'db.json')).init();
const ctx={companyId:'c1',userId:'owner',role:'owner'};
await store.putUser({id:'u1',companyId:'c1',email:'a@b.c',role:'owner',active:true});
await store.tenant(ctx).put('Product',{id:'p1',name:'Товар'});
const svc=new CompanyBackupService({store,backupDir:path.join(dir,'backups'),now:()=>new Date('2026-09-13T10:00:00Z')});
const b=await svc.create('c1');const check=await svc.verify(b.file);assert.equal(check.ok,true);assert.equal(check.companyId,'c1');
await store.tenant(ctx).remove('Product','p1');assert.equal(store.tenant(ctx).get('Product','p1'),null);
await svc.restore(b.file);assert.equal(store.tenant(ctx).get('Product','p1').name,'Товар');
await rm(dir,{recursive:true,force:true});console.log('EINEIRO company backup tests: OK');

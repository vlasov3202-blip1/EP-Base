import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {JsonFileStore} from './storage.mjs';
import {AuthService} from './auth.mjs';
import {BackupService} from './infra.mjs';
import {CompanyBackupService} from './company-backup.mjs';

const dir=await mkdtemp(path.join(os.tmpdir(),'eineiro-recovery-security-'));
try{
  const dataFile=path.join(dir,'eineiro.json');
  const store=await new JsonFileStore(dataFile).init();
  const auth=new AuthService(store);

  const publicUser=await auth.registerPublic({
    companyId:'victim-company',userId:'root',identityId:'root-identity',role:'admin',
    email:'founder@example.com',password:'founder-secret',name:'Founder'
  });
  assert.equal(publicUser.companyId,null);
  assert.notEqual(publicUser.id,'root');
  assert.notEqual(publicUser.identityId,'root-identity');
  assert.equal(publicUser.role,'buyer');
  assert.equal('passwordHash' in publicUser,false);

  await auth.register({companyId:'c1',userId:'owner-1',identityId:'identity-owner',email:'owner@example.com',password:'owner-secret',role:'owner'});
  const invite=await auth.createInvite({companyId:'c1',userId:'owner-1',role:'owner'},{email:'worker@example.com',role:'seller'});
  const worker=await auth.registerPublic({companyId:'victim-company',userId:'admin-user',identityId:'admin-id',role:'admin',email:'worker@example.com',password:'worker-secret',inviteToken:invite.token});
  assert.equal(worker.companyId,'c1');
  assert.equal(worker.role,'seller');
  assert.notEqual(worker.id,'admin-user');
  assert.equal('passwordHash' in worker,false);
  await assert.rejects(()=>auth.registerPublic({email:'worker@example.com',password:'worker-secret-2',inviteToken:invite.token}),/invite already used/);

  await auth.register({companyId:'c2',userId:'owner-2',email:'other@example.com',password:'other-secret',role:'owner'});
  await store.tenant({companyId:'c1'}).put('Product',{id:'p1',name:'Tenant A secret'});
  await store.tenant({companyId:'c2'}).put('Product',{id:'p2',name:'Tenant B secret'});
  const companyBackups=new CompanyBackupService({store,backupDir:path.join(dir,'company-backups')});
  const backup=await companyBackups.create('c1');
  const raw=await readFile(backup.file,'utf8');
  assert.match(raw,/Tenant A secret/);
  assert.doesNotMatch(raw,/Tenant B secret/);
  assert.doesNotMatch(raw,/other@example.com/);

  const platformFile=path.join(dir,'platform.json');
  await writeFile(platformFile,'{}');
  const platformBackups=new BackupService({dataFile:platformFile,backupDir:path.join(dir,'platform-backups')});
  await assert.rejects(()=>platformBackups.create({scope:'company',companyId:'c1'}),/only supports platform scope/);
  await assert.rejects(()=>platformBackups.restore('/etc/passwd'),/invalid backup file/);

  console.log('EINEIRO recovery security boundary tests: OK');
} finally {
  await rm(dir,{recursive:true,force:true});
}

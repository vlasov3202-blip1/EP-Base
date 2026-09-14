import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {MemoryRepository} from './core.mjs';
import {EncryptedFileEvidenceStorage,ModerationEvidenceService} from './moderation-evidence.mjs';

const owner={companyId:'evidence-c1',userId:'owner',role:'owner'};
const seller={companyId:'evidence-c1',userId:'seller-1',role:'seller'};
const intruder={companyId:'evidence-c1',userId:'seller-2',role:'seller'};
const memory=new MemoryRepository();
const repo={
  put:(entity,record)=>memory.put(owner,entity,record),
  get:(entity,id)=>memory.get(owner,entity,id),
  list:entity=>memory.list(owner,entity)
};
await repo.put('ModerationCase',{id:'mod-evidence-1',objectType:'Offer',offerId:'offer-1',productId:'product-1',sellerId:'seller-1',decision:'AUTO_REJECTED',status:'REJECTED'});
const directory=await mkdtemp(path.join(tmpdir(),'eineiro-evidence-'));
let clock=new Date('2026-09-14T12:00:00Z');
const storage=new EncryptedFileEvidenceStorage({rootDir:directory,key:Buffer.alloc(32,7)});
const service=new ModerationEvidenceService({repoFactory:()=>repo,storage,now:()=>new Date(clock),maxBytes:1024*1024,retentionDays:1});
const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
try{
  const uploaded=await service.upload(seller,{
    moderationCaseId:'mod-evidence-1',
    fileName:'../../origin.pdf',
    mimeType:'application/pdf',
    kind:'document',
    contentBase64:pdf.toString('base64')
  });
  assert.equal(uploaded.fileName,'origin.pdf');
  assert.equal(uploaded.mimeType,'application/pdf');
  assert.equal(uploaded.byteSize,pdf.length);
  assert.match(uploaded.sha256,/^[a-f0-9]{64}$/);
  assert.equal(Object.hasOwn(uploaded,'contentBase64'),false);

  const files=await readdir(directory,{recursive:true});
  const encryptedPath=files.find(name=>String(name).endsWith('.enc'));
  assert.ok(encryptedPath);
  const encrypted=await readFile(path.join(directory,encryptedPath));
  assert.equal(encrypted.includes(pdf),false);
  assert.equal(encrypted.subarray(0,7).toString(),'EINMOD1');

  const metadata=await service.get(seller,uploaded.id);
  assert.equal(metadata.sha256,uploaded.sha256);
  const downloaded=await service.get(seller,uploaded.id,{includeContent:true});
  assert.deepEqual(Buffer.from(downloaded.contentBase64,'base64'),pdf);
  assert.equal((await service.listForCase(seller,'mod-evidence-1')).length,1);
  await assert.rejects(()=>service.get(intruder,uploaded.id),error=>error.code==='FORBIDDEN');

  await assert.rejects(()=>service.upload(seller,{
    moderationCaseId:'mod-evidence-1',
    fileName:'fake.jpg',
    mimeType:'image/jpeg',
    kind:'photo',
    contentBase64:pdf.toString('base64')
  }),error=>error.code==='EVIDENCE_CONTENT_MISMATCH');

  clock=new Date('2026-09-16T12:00:00Z');
  const purged=await service.purgeExpired(owner);
  assert.equal(purged.purged,1);
  await assert.rejects(()=>service.get(seller,uploaded.id,{includeContent:true}),error=>error.code==='EVIDENCE_NOT_AVAILABLE');
  assert.equal((await service.listForCase(seller,'mod-evidence-1')).length,0);

  const disabled=new ModerationEvidenceService({repoFactory:()=>repo});
  await assert.rejects(()=>disabled.upload(seller,{moderationCaseId:'mod-evidence-1'}),error=>error.code==='EVIDENCE_STORAGE_DISABLED');
}finally{
  await rm(directory,{recursive:true,force:true});
}
console.log('EINEIRO encrypted moderation evidence tests: OK');

import crypto from 'node:crypto';
import {mkdir,readFile,rename,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';

const ALLOWED_MIME_TYPES=new Set(['image/jpeg','image/png','image/webp','application/pdf','text/plain']);
const EVIDENCE_KINDS=new Set(['document','certificate','invoice','seller_statement','photo','other']);
const MAGIC=Buffer.from('EINMOD1');

export class EncryptedFileEvidenceStorage{
  constructor({rootDir,key}={}){
    if(!rootDir)throw new Error('evidence rootDir required');
    this.rootDir=path.resolve(rootDir);
    this.key=normalizeKey(key);
  }
  async put({companyId,id,bytes}={}){
    const directory=path.join(this.rootDir,tenantDirectory(companyId));
    await mkdir(directory,{recursive:true,mode:0o700});
    const target=path.join(directory,safeId(id)+'.enc');
    const temporary=target+'.'+crypto.randomUUID()+'.tmp';
    const iv=crypto.randomBytes(12);
    const cipher=crypto.createCipheriv('aes-256-gcm',this.key,iv);
    cipher.setAAD(Buffer.from(String(companyId)+':'+String(id)));
    const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
    const tag=cipher.getAuthTag();
    await writeFile(temporary,Buffer.concat([MAGIC,iv,tag,encrypted]),{mode:0o600,flag:'wx'});
    await rename(temporary,target);
    return{id,size:bytes.length};
  }
  async get({companyId,id}={}){
    const source=path.join(this.rootDir,tenantDirectory(companyId),safeId(id)+'.enc');
    const envelope=await readFile(source);
    if(envelope.length<MAGIC.length+28||!envelope.subarray(0,MAGIC.length).equals(MAGIC))throw codedError('invalid evidence envelope','EVIDENCE_STORAGE_CORRUPT',500);
    const iv=envelope.subarray(MAGIC.length,MAGIC.length+12);
    const tag=envelope.subarray(MAGIC.length+12,MAGIC.length+28);
    const ciphertext=envelope.subarray(MAGIC.length+28);
    const decipher=crypto.createDecipheriv('aes-256-gcm',this.key,iv);
    decipher.setAAD(Buffer.from(String(companyId)+':'+String(id)));
    decipher.setAuthTag(tag);
    try{return Buffer.concat([decipher.update(ciphertext),decipher.final()]);}
    catch{throw codedError('evidence authentication failed','EVIDENCE_STORAGE_CORRUPT',500);}
  }
  async remove({companyId,id}={}){
    const source=path.join(this.rootDir,tenantDirectory(companyId),safeId(id)+'.enc');
    try{await unlink(source);return true;}catch(error){if(error?.code==='ENOENT')return false;throw error;}
  }
}

export class ModerationEvidenceService{
  constructor({repoFactory,storage=null,audit=null,events=null,now=()=>new Date(),maxBytes=10_000_000,retentionDays=365}={}){
    if(typeof repoFactory!=='function')throw new Error('repoFactory required');
    this.repoFactory=repoFactory;this.storage=storage;this.audit=audit;this.events=events;this.now=now;this.maxBytes=Math.max(1,Number(maxBytes));this.retentionDays=Math.max(1,Number(retentionDays));
  }
  async upload(ctx,{moderationCaseId,fileName,mimeType,contentBase64,kind='other'}={}){
    if(!this.storage)throw codedError('protected evidence storage is not configured','EVIDENCE_STORAGE_DISABLED',503);
    if(!ALLOWED_MIME_TYPES.has(mimeType))throw codedError('unsupported evidence type','EVIDENCE_TYPE_UNSUPPORTED',415);
    if(!EVIDENCE_KINDS.has(kind))throw codedError('unsupported evidence kind','EVIDENCE_KIND_UNSUPPORTED',400);
    const repo=this.repoFactory(ctx);
    const moderationCase=await repo.get('ModerationCase',moderationCaseId);
    if(!moderationCase)throw codedError('moderation case not found','MODERATION_CASE_NOT_FOUND',404);
    assertAccess(ctx,moderationCase);
    const bytes=decodeBase64(contentBase64);
    if(!bytes.length||bytes.length>this.maxBytes)throw codedError('evidence file size is invalid','EVIDENCE_SIZE_INVALID',413);
    assertMagic(bytes,mimeType);
    const id='modev_'+crypto.randomUUID();
    const at=this.now();
    const record={
      id,
      moderationCaseId:moderationCase.id,
      offerId:moderationCase.offerId,
      productId:moderationCase.productId,
      sellerId:moderationCase.sellerId,
      kind,
      fileName:safeFileName(fileName),
      mimeType,
      byteSize:bytes.length,
      sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
      storage:'encrypted_file',
      status:'active',
      createdBy:{id:ctx.userId,role:ctx.role},
      createdAt:at.toISOString(),
      expiresAt:new Date(at.getTime()+this.retentionDays*86400000).toISOString()
    };
    await this.storage.put({companyId:ctx.companyId,id,bytes});
    try{await repo.put('ModerationEvidence',record);}
    catch(error){await this.storage.remove({companyId:ctx.companyId,id}).catch(()=>{});throw error;}
    await this.events?.emit?.(ctx,'moderation.evidence.uploaded',{evidenceId:id,moderationCaseId:record.moderationCaseId,kind,mimeType,byteSize:bytes.length});
    await this.audit?.write?.(ctx,{
      actor:{type:'user',id:ctx.userId,role:ctx.role},
      action:'moderation.evidence.upload',
      object:{type:'ModerationEvidence',id,moderationCaseId:record.moderationCaseId},
      reason:kind,
      result:{mimeType,byteSize:bytes.length,sha256:record.sha256}
    });
    return publicRecord(record);
  }
  async get(ctx,id,{includeContent=false}={}){
    const repo=this.repoFactory(ctx);
    const record=await repo.get('ModerationEvidence',id);
    if(!record)return null;
    assertAccess(ctx,record);
    if(!includeContent)return publicRecord(record);
    if(record.status!=='active')throw codedError('evidence is not available','EVIDENCE_NOT_AVAILABLE',410);
    if(!this.storage)throw codedError('protected evidence storage is not configured','EVIDENCE_STORAGE_DISABLED',503);
    const bytes=await this.storage.get({companyId:ctx.companyId,id:record.id});
    const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
    if(sha256!==record.sha256)throw codedError('evidence integrity check failed','EVIDENCE_INTEGRITY_FAILED',500);
    return{...publicRecord(record),contentBase64:bytes.toString('base64')};
  }
  async listForCase(ctx,moderationCaseId){
    const moderationCase=await this.repoFactory(ctx).get('ModerationCase',moderationCaseId);
    if(!moderationCase)throw codedError('moderation case not found','MODERATION_CASE_NOT_FOUND',404);
    assertAccess(ctx,moderationCase);
    return(await this.repoFactory(ctx).list('ModerationEvidence'))
      .filter(row=>row.moderationCaseId===moderationCaseId&&row.status==='active')
      .map(publicRecord);
  }
  async purgeExpired(ctx){
    if(!this.storage)return{checked:0,purged:0};
    const repo=this.repoFactory(ctx);
    const rows=await repo.list('ModerationEvidence');
    const nowMs=this.now().getTime();
    let purged=0;
    for(const row of rows){
      if(row.status!=='active'||Date.parse(row.expiresAt)>nowMs)continue;
      await this.storage.remove({companyId:ctx.companyId,id:row.id});
      await repo.put('ModerationEvidence',{...row,status:'purged',purgedAt:this.now().toISOString()});
      purged++;
    }
    return{checked:rows.length,purged};
  }
}

function normalizeKey(value){
  if(Buffer.isBuffer(value)&&value.length===32)return Buffer.from(value);
  const text=String(value||'').trim();
  if(!text)throw new Error('evidence encryption key required');
  if(/^[a-f0-9]{64}$/i.test(text))return Buffer.from(text,'hex');
  try{const decoded=Buffer.from(text,'base64');if(decoded.length===32&&decoded.toString('base64').replace(/=+$/,'')===text.replace(/=+$/,''))return decoded;}catch{}
  throw new Error('evidence encryption key must be 32 bytes encoded as base64 or 64 hex characters');
}
function tenantDirectory(companyId){
  if(!companyId)throw new Error('companyId required');
  return crypto.createHash('sha256').update(String(companyId)).digest('hex').slice(0,32);
}
function safeId(value){
  const id=String(value||'');
  if(!/^[a-zA-Z0-9_-]{8,100}$/.test(id))throw new Error('invalid evidence id');
  return id;
}
function safeFileName(value){
  const name=path.basename(String(value||'evidence')).replace(/[\u0000-\u001f\u007f]/g,'').slice(0,160);
  return name||'evidence';
}
function decodeBase64(value){
  const text=String(value||'').replace(/\s+/g,'');
  if(!text||!/^[A-Za-z0-9+/]*={0,2}$/.test(text)||text.length%4!==0)throw codedError('invalid evidence encoding','EVIDENCE_ENCODING_INVALID',400);
  return Buffer.from(text,'base64');
}
function assertMagic(bytes,mimeType){
  const ok=mimeType==='image/jpeg'?bytes.length>3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff
    :mimeType==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    :mimeType==='image/webp'?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'
    :mimeType==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-'
    :mimeType==='text/plain'&&!bytes.includes(0);
  if(!ok)throw codedError('evidence content does not match MIME type','EVIDENCE_CONTENT_MISMATCH',415);
}
function assertAccess(ctx,row){
  if(ctx.role!=='seller')return;
  if(row.sellerId!==(ctx.user?.sellerId||ctx.userId))throw codedError('evidence access denied','FORBIDDEN',403);
}
function publicRecord(record){
  const out=structuredClone(record);
  delete out.companyId;
  return out;
}
function codedError(message,code,status){
  return Object.assign(new Error(message),{code,status});
}
export {ALLOWED_MIME_TYPES,EVIDENCE_KINDS};

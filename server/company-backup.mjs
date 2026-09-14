import {mkdir,readFile,readdir,rename,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export class CompanyBackupService{
  constructor({store,backupDir=path.join(process.cwd(),'backups','companies'),evidenceDir=null,retainPerCompany=12,now=()=>new Date()}={}){if(!store)throw new Error('store required');this.store=store;this.backupDir=backupDir;this.evidenceDir=evidenceDir?path.resolve(evidenceDir):null;this.retainPerCompany=retainPerCompany;this.now=now;}
  async create(companyId){
    if(!companyId)throw new Error('companyId required');
    await mkdir(this.backupDir,{recursive:true});
    const payload=await this.store.exportCompany(companyId);
    payload.evidenceFiles=await this.exportEvidenceFiles(companyId,payload.records||[]);
    const json=JSON.stringify(payload,null,2);
    const checksum=sha256(json);
    const stamp=this.now().toISOString().replace(/[:.]/g,'-');
    const file=path.join(this.backupDir,`${stamp}-company-${safe(companyId)}.json`);
    await writeFile(file,json,{mode:0o600});
    await writeFile(`${file}.sha256`,checksum,{mode:0o600});
    await this.prune(companyId);
    return {file,companyId,checksum,createdAt:this.now().toISOString(),size:Buffer.byteLength(json),evidenceFiles:payload.evidenceFiles.length};
  }
  async verify(file){
    const raw=await readFile(file,'utf8');
    const expected=(await readFile(`${file}.sha256`,'utf8')).trim();
    const actual=sha256(raw);
    const parsed=JSON.parse(raw);
    return {ok:actual===expected&&Boolean(parsed.companyId),file,companyId:parsed.companyId,checksum:actual,evidenceFiles:Array.isArray(parsed.evidenceFiles)?parsed.evidenceFiles.length:0};
  }
  async list(companyId=null){await mkdir(this.backupDir,{recursive:true});const names=(await readdir(this.backupDir)).filter(x=>x.endsWith('.json')).sort().reverse();return names.filter(x=>!companyId||x.includes(`company-${safe(companyId)}`)).map(name=>({name,file:path.join(this.backupDir,name)}));}
  async restore(file,{targetCompanyId=null}={}){
    const check=await this.verify(file);
    if(!check.ok)throw new Error('backup integrity check failed');
    const data=JSON.parse(await readFile(file,'utf8'));
    const companyId=targetCompanyId||data.companyId;
    const evidenceFiles=await this.validateEvidenceFiles(data,companyId);
    for(const user of data.users||[])await this.store.putUser({...user,companyId});
    const repo=this.store.tenant({companyId});
    for(const rec of data.records||[]){const entity=rec.__entity||inferEntity(rec);const clean={...rec};delete clean.__entity;delete clean.__recordId;clean.companyId=companyId;if(entity&&clean.id)await repo.put(entity,clean)}
    for(const e of data.audit||[])await this.store.appendAudit({...e,companyId});
    for(const e of data.events||[])await this.store.appendEvent({...e,companyId});
    await this.restoreEvidenceFiles(companyId,evidenceFiles);
    return {restored:true,sourceCompanyId:data.companyId,targetCompanyId:companyId,restoredAt:this.now().toISOString(),evidenceFiles:evidenceFiles.length};
  }
  async exportEvidenceFiles(companyId,records){
    const evidence=records.filter(row=>row.__entity==='ModerationEvidence'&&row.status==='active'&&row.id);
    if(!evidence.length)return[];
    if(!this.evidenceDir)throw codedError('evidence directory is required for complete backup','EVIDENCE_BACKUP_STORAGE_REQUIRED');
    const out=[];
    for(const row of evidence){
      const envelope=await readFile(evidencePath(this.evidenceDir,companyId,row.id));
      out.push({id:row.id,sha256:sha256(envelope),contentBase64:envelope.toString('base64')});
    }
    return out;
  }
  async validateEvidenceFiles(data,targetCompanyId){
    const files=Array.isArray(data.evidenceFiles)?data.evidenceFiles:[];
    if(!files.length)return[];
    if(targetCompanyId!==data.companyId)throw codedError('encrypted evidence cannot be restored to another company','EVIDENCE_CROSS_TENANT_RESTORE_FORBIDDEN');
    if(!this.evidenceDir)throw codedError('evidence directory is required for restore','EVIDENCE_BACKUP_STORAGE_REQUIRED');
    return files.map(item=>{
      if(!item||typeof item.id!=='string'||typeof item.contentBase64!=='string'||typeof item.sha256!=='string')throw codedError('invalid evidence backup entry','EVIDENCE_BACKUP_INVALID');
      const content=decodeBase64(item.contentBase64);
      if(sha256(content)!==item.sha256)throw codedError('evidence backup integrity check failed','EVIDENCE_BACKUP_INTEGRITY_FAILED');
      evidencePath(this.evidenceDir,targetCompanyId,item.id);
      return{id:item.id,content};
    });
  }
  async restoreEvidenceFiles(companyId,files){
    for(const item of files){
      const target=evidencePath(this.evidenceDir,companyId,item.id);
      await mkdir(path.dirname(target),{recursive:true,mode:0o700});
      const temporary=target+'.'+crypto.randomUUID()+'.tmp';
      await writeFile(temporary,item.content,{mode:0o600,flag:'wx'});
      await rename(temporary,target);
    }
  }
  async prune(companyId){const list=await this.list(companyId);for(const x of list.slice(this.retainPerCompany)){await unlink(x.file).catch(()=>{});await unlink(`${x.file}.sha256`).catch(()=>{});}return list.slice(0,this.retainPerCompany);}
}
function evidencePath(rootDir,companyId,id){return path.join(rootDir,tenantDirectory(companyId),safeEvidenceId(id)+'.enc')}
function tenantDirectory(companyId){if(!companyId)throw new Error('companyId required');return sha256(String(companyId)).slice(0,32)}
function safeEvidenceId(value){const id=String(value||'');if(!/^[a-zA-Z0-9_-]{8,100}$/.test(id))throw codedError('invalid evidence id','EVIDENCE_BACKUP_INVALID');return id}
function decodeBase64(value){const text=String(value||'');if(!text||!/^[A-Za-z0-9+/]*={0,2}$/.test(text)||text.length%4!==0)throw codedError('invalid evidence backup encoding','EVIDENCE_BACKUP_INVALID');return Buffer.from(text,'base64')}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex')}
function codedError(message,code){return Object.assign(new Error(message),{code})}
function safe(v){return String(v).replace(/[^a-zA-Z0-9_-]/g,'_')}
function inferEntity(rec){if(rec.productId&&rec.quantity!=null)return'InventoryUnit';if(rec.email&&rec.role)return'User';return rec.entity||null}

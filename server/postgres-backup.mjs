import {mkdir,readdir,stat,unlink} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';

function run(cmd,args,env={}){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code===0?resolve({out,err}):reject(Object.assign(new Error(err||`${cmd} exited ${code}`),{code:'BACKUP_COMMAND_FAILED'})));});}

export class PostgresBackupService{
  constructor({connectionString=process.env.DATABASE_URL,backupDir=path.join(process.cwd(),'backups','postgres'),retain=12,now=()=>new Date()}={}){if(!connectionString)throw new Error('DATABASE_URL required');this.connectionString=connectionString;this.backupDir=backupDir;this.retain=retain;this.now=now;}
  async create(){await mkdir(this.backupDir,{recursive:true});const stamp=this.now().toISOString().replace(/[:.]/g,'-');const file=path.join(this.backupDir,`${stamp}.dump`);await run('pg_dump',['--format=custom','--no-owner','--no-privileges','--file',file,this.connectionString]);await this.verify(file);await this.prune();const s=await stat(file);return{file,path:file,size:s.size,createdAt:this.now().toISOString(),verified:true};}
  async verify(file){await run('pg_restore',['--list',file]);return{ok:true,file};}
  async restore(file,{targetConnectionString=this.connectionString,clean=false}={}){const full=path.isAbsolute(file)?file:path.join(this.backupDir,file);await this.verify(full);const args=['--no-owner','--no-privileges'];if(clean)args.push('--clean','--if-exists');args.push('--dbname',targetConnectionString,full);await run('pg_restore',args);return{restoredFrom:full,restoredAt:this.now().toISOString()};}
  async list(){try{return await Promise.all((await readdir(this.backupDir)).filter(n=>n.endsWith('.dump')).sort().reverse().map(async name=>{const full=path.join(this.backupDir,name);const s=await stat(full);return{name,path:full,size:s.size,mtime:s.mtime.toISOString()};}));}catch(e){if(e.code==='ENOENT')return[];throw e;}}
  async prune(){const items=await this.list();for(const item of items.slice(this.retain))await unlink(item.path).catch(()=>{});return items.slice(0,this.retain);}
}

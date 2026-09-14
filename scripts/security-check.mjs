import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();const findings=[];
const files=await walk(root);
const tracked=files.filter(file=>!file.includes('/.git/')&&!file.includes('/node_modules/')&&!file.includes('/dist/'));
for(const file of tracked){
  const relative=path.relative(root,file).replaceAll('\\','/');
  if(/(^|\/)\.env($|\.)/.test(relative)&&relative!=='.env.example')findings.push(`forbidden secret file: ${relative}`);
  if(/\.(pem|p12|pfx|key)$/i.test(relative))findings.push(`forbidden key file: ${relative}`);
  if(!/\.(?:js|mjs|json|md|html|css|ya?ml|txt)$/i.test(relative))continue;
  const content=await readFile(file,'utf8').catch(()=>null);if(content==null)continue;
  const privateKey=['-----BEGIN','PRIVATE KEY-----'].join(' ');
  const openAiPrefix=['s','k','-'].join('');
  if(content.includes(privateKey))findings.push(`private key material: ${relative}`);
  if(new RegExp(openAiPrefix+'[A-Za-z0-9_-]{20,}').test(content))findings.push(`possible API secret: ${relative}`);
  if(/rejectUnauthorized\s*:\s*false/.test(content))findings.push(`TLS verification disabled: ${relative}`);
}
const gitignore=await readFile(path.join(root,'.gitignore'),'utf8');
for(const required of ['.env','.env.*','*.pem','*.key'])if(!gitignore.split(/\r?\n/).includes(required))findings.push(`.gitignore missing ${required}`);
const auth=await readFile(path.join(root,'server','auth.mjs'),'utf8');
if(!auth.includes('tokenHash(token)'))findings.push('session tokens are not hashed');
const business=await readFile(path.join(root,'server','business-api.mjs'),'utf8');
if(!business.includes('requireBusinessAccess(ctx)'))findings.push('Business API lacks central role gate');
const market=await readFile(path.join(root,'server','market-api.mjs'),'utf8');
if(!market.includes("scope:'vision-minute'")||!market.includes('VISION_KILL_SWITCH'))findings.push('Vision API lacks budget controls');
const postgres=await readFile(path.join(root,'server','postgres-storage.mjs'),'utf8');
if(!postgres.includes('rejectUnauthorized:true'))findings.push('PostgreSQL certificate verification is not strict');
if(!postgres.includes('ENABLE ROW LEVEL SECURITY')||!postgres.includes("set_config('eineiro.company_id'"))findings.push('PostgreSQL tenant RLS is not configured');
const rateLimit=await readFile(path.join(root,'server','distributed-rate-limit.mjs'),'utf8');
if(!rateLimit.includes('ON CONFLICT(bucket_key) DO UPDATE')||!rateLimit.includes("createHmac('sha256'")||!rateLimit.includes('RATE_LIMIT_HASH_KEY_REQUIRED'))findings.push('distributed rate limit is not atomic or privacy-safe');
const audit=await readFile(path.join(root,'server','audit-log.mjs'),'utf8');
if(!audit.includes("createHmac('sha256'")||!audit.includes('PREVIOUS_HASH_MISMATCH'))findings.push('audit integrity chain is not enforced');
if(findings.length){for(const finding of findings)console.error('SECURITY:',finding);process.exit(1)}
console.log(`EINEIRO security static checks: OK (${tracked.length} files)`);

async function walk(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())out.push(...await walk(full));else if(entry.isFile())out.push(full)}return out}

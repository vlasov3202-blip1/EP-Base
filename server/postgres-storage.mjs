import {tenantKey} from './core.mjs';
import {PostgresFixedWindowRateLimiter} from './distributed-rate-limit.mjs';

export const POSTGRES_SCHEMA_VERSION=2;

const MIGRATIONS=[{
  version:1,
  sql:`
CREATE TABLE IF NOT EXISTS eineiro_schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS eineiro_users (
  company_id text NOT NULL,
  user_id text NOT NULL,
  email text NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (company_id,user_id),
  UNIQUE (company_id,email)
);
CREATE TABLE IF NOT EXISTS eineiro_sessions (
  session_id text PRIMARY KEY,
  company_id text NOT NULL,
  user_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eineiro_sessions_company ON eineiro_sessions(company_id);
CREATE TABLE IF NOT EXISTS eineiro_records (
  company_id text NOT NULL,
  entity text NOT NULL,
  record_id text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id,entity,record_id)
);
CREATE INDEX IF NOT EXISTS idx_eineiro_records_company_entity ON eineiro_records(company_id,entity);
CREATE TABLE IF NOT EXISTS eineiro_audit (
  id bigserial PRIMARY KEY,
  company_id text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eineiro_audit_company ON eineiro_audit(company_id,id);
CREATE TABLE IF NOT EXISTS eineiro_events (
  id bigserial PRIMARY KEY,
  company_id text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eineiro_events_company ON eineiro_events(company_id,id);
`
},{
  version:2,
  sql:`
CREATE TABLE IF NOT EXISTS eineiro_rate_limits (
  bucket_key text PRIMARY KEY,
  count bigint NOT NULL,
  reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eineiro_rate_limits_expiry ON eineiro_rate_limits(reset_at);

ALTER TABLE eineiro_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE eineiro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE eineiro_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE eineiro_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE eineiro_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eineiro_tenant_users ON eineiro_users;
CREATE POLICY eineiro_tenant_users ON eineiro_users
  USING (company_id = current_setting('eineiro.company_id',true))
  WITH CHECK (company_id = current_setting('eineiro.company_id',true));
DROP POLICY IF EXISTS eineiro_tenant_sessions ON eineiro_sessions;
CREATE POLICY eineiro_tenant_sessions ON eineiro_sessions
  USING (company_id = current_setting('eineiro.company_id',true))
  WITH CHECK (company_id = current_setting('eineiro.company_id',true));
DROP POLICY IF EXISTS eineiro_tenant_records ON eineiro_records;
CREATE POLICY eineiro_tenant_records ON eineiro_records
  USING (company_id = current_setting('eineiro.company_id',true))
  WITH CHECK (company_id = current_setting('eineiro.company_id',true));
DROP POLICY IF EXISTS eineiro_tenant_audit ON eineiro_audit;
CREATE POLICY eineiro_tenant_audit ON eineiro_audit
  USING (company_id = current_setting('eineiro.company_id',true))
  WITH CHECK (company_id = current_setting('eineiro.company_id',true));
DROP POLICY IF EXISTS eineiro_tenant_events ON eineiro_events;
CREATE POLICY eineiro_tenant_events ON eineiro_events
  USING (company_id = current_setting('eineiro.company_id',true))
  WITH CHECK (company_id = current_setting('eineiro.company_id',true));
`
}];

export async function migratePostgres(pool){
  await pool.query('BEGIN');
  try{
    await pool.query('CREATE TABLE IF NOT EXISTS eineiro_schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done=new Set((await pool.query('SELECT version FROM eineiro_schema_migrations')).rows.map(r=>Number(r.version)));
    for(const m of MIGRATIONS){if(done.has(m.version))continue;await pool.query(m.sql);await pool.query('INSERT INTO eineiro_schema_migrations(version) VALUES($1)',[m.version]);}
    await pool.query('COMMIT');
  }catch(error){await pool.query('ROLLBACK');throw error;}
}

export class PostgresStore{
  constructor(pool,{tenantPool=pool}={}){this.pool=pool;this.tenantPool=tenantPool;this.rateLimiter=new PostgresFixedWindowRateLimiter(pool);}
  async init(){await migratePostgres(this.pool);return this;}
  tenant(ctx){if(!ctx?.companyId)throw new Error('companyId required');return new PostgresTenantRepository(this.tenantPool,ctx.companyId);}
  async putUser(user){await this.pool.query(`INSERT INTO eineiro_users(company_id,user_id,email,data) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(company_id,user_id) DO UPDATE SET email=EXCLUDED.email,data=EXCLUDED.data`,[user.companyId,user.id,user.email,JSON.stringify(user)]);return structuredClone(user);}
  async getUser(companyId,userId){const r=await this.pool.query('SELECT data FROM eineiro_users WHERE company_id=$1 AND user_id=$2',[companyId,userId]);return r.rows[0]?.data||null;}
  async findUserByEmail(companyId,email){const r=await this.pool.query('SELECT data FROM eineiro_users WHERE company_id=$1 AND email=$2',[companyId,String(email).trim().toLowerCase()]);return r.rows[0]?.data||null;}
  async putSession(session){await this.pool.query(`INSERT INTO eineiro_sessions(session_id,company_id,user_id,expires_at,data) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(session_id) DO UPDATE SET expires_at=EXCLUDED.expires_at,data=EXCLUDED.data`,[session.id,session.companyId,session.userId,session.expiresAt,JSON.stringify(session)]);return structuredClone(session);}
  async getSession(id){const r=await this.pool.query('SELECT data FROM eineiro_sessions WHERE session_id=$1',[id]);return r.rows[0]?.data||null;}
  async removeSession(id){await this.pool.query('DELETE FROM eineiro_sessions WHERE session_id=$1',[id]);}
  async appendAudit(event){await this.pool.query('INSERT INTO eineiro_audit(company_id,data) VALUES($1,$2::jsonb)',[event.companyId,JSON.stringify(event)]);}
  async listAudit(companyId){return (await this.pool.query('SELECT data FROM eineiro_audit WHERE company_id=$1 ORDER BY id',[companyId])).rows.map(r=>r.data);}
  async appendEvent(event){await this.pool.query('INSERT INTO eineiro_events(company_id,data) VALUES($1,$2::jsonb)',[event.companyId,JSON.stringify(event)]);}
  async listEvents(companyId){return (await this.pool.query('SELECT data FROM eineiro_events WHERE company_id=$1 ORDER BY id',[companyId])).rows.map(r=>r.data);}
  async listAllApiKeys(){return (await this.pool.query("SELECT data FROM eineiro_records WHERE entity='ApiKey'")).rows.map(r=>r.data);}
  async listCompanyIds(){const r=await this.pool.query("SELECT company_id FROM eineiro_users UNION SELECT company_id FROM eineiro_records ORDER BY company_id");return r.rows.map(x=>x.company_id);}
  async exportCompany(companyId){
    const [users,records,audit,events]=await Promise.all([
      this.pool.query('SELECT data FROM eineiro_users WHERE company_id=$1 ORDER BY user_id',[companyId]),
      this.pool.query('SELECT entity,record_id,data FROM eineiro_records WHERE company_id=$1 ORDER BY entity,record_id',[companyId]),
      this.pool.query('SELECT data FROM eineiro_audit WHERE company_id=$1 ORDER BY id',[companyId]),
      this.pool.query('SELECT data FROM eineiro_events WHERE company_id=$1 ORDER BY id',[companyId])
    ]);
    return {companyId,users:users.rows.map(r=>r.data),records:records.rows.map(r=>({...r.data,__entity:r.entity,__recordId:r.record_id})),audit:audit.rows.map(r=>r.data),events:events.rows.map(r=>r.data),exportedAt:new Date().toISOString()};
  }
}

export class PostgresTenantRepository{
  constructor(pool,companyId){this.pool=pool;this.companyId=companyId;}
  async put(entity,record){if(!record?.id)throw new Error('record.id required');const value={...structuredClone(record),companyId:this.companyId,updatedAt:new Date().toISOString()};await withTenantClient(this.pool,this.companyId,client=>client.query(`INSERT INTO eineiro_records(company_id,entity,record_id,data,updated_at) VALUES($1,$2,$3,$4::jsonb,now()) ON CONFLICT(company_id,entity,record_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,[this.companyId,entity,record.id,JSON.stringify(value)]));return value;}
  async get(entity,id){const r=await withTenantClient(this.pool,this.companyId,client=>client.query('SELECT data FROM eineiro_records WHERE company_id=$1 AND entity=$2 AND record_id=$3',[this.companyId,entity,id]));return r.rows[0]?.data||null;}
  async list(entity){return (await withTenantClient(this.pool,this.companyId,client=>client.query('SELECT data FROM eineiro_records WHERE company_id=$1 AND entity=$2 ORDER BY updated_at DESC',[this.companyId,entity]))).rows.map(r=>r.data);}
  async remove(entity,id){await withTenantClient(this.pool,this.companyId,client=>client.query('DELETE FROM eineiro_records WHERE company_id=$1 AND entity=$2 AND record_id=$3',[this.companyId,entity,id]));}
}

async function withTenantClient(pool,companyId,operation){
  const client=typeof pool.connect==='function'?await pool.connect():pool;
  try{
    await client.query('BEGIN');
    await client.query("SELECT set_config('eineiro.company_id',$1,true)",[companyId]);
    const result=await operation(client);
    await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client.release?.();}
}

export async function createPostgresStore(connectionString=process.env.DATABASE_URL){
  if(!connectionString)throw new Error('DATABASE_URL required');
  const {Pool}=await import('pg');
  const ssl=process.env.DATABASE_SSL==='true'?{
    rejectUnauthorized:true,
    ...(process.env.DATABASE_SSL_CA?{ca:process.env.DATABASE_SSL_CA.replaceAll('\\n','\n')}:{})
  }:undefined;
  if(process.env.NODE_ENV==='production'&&process.env.DATABASE_SSL!=='true')throw Object.assign(new Error('verified database TLS is required in production'),{code:'DATABASE_TLS_REQUIRED'});
  const tenantConnectionString=process.env.DATABASE_TENANT_URL||'';
  if(process.env.DATABASE_RLS_REQUIRED==='true'&&(!tenantConnectionString||tenantConnectionString===connectionString))throw Object.assign(new Error('a separate PostgreSQL tenant identity is required'),{code:'DATABASE_TENANT_IDENTITY_REQUIRED'});
  const poolOptions={max:Number(process.env.DATABASE_POOL_MAX||20),ssl,connectionTimeoutMillis:Number(process.env.DATABASE_CONNECT_TIMEOUT_MS||10_000),statement_timeout:Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS||30_000)};
  const pool=new Pool({connectionString,...poolOptions});
  const tenantPool=tenantConnectionString?new Pool({connectionString:tenantConnectionString,...poolOptions}):pool;
  try{const store=await new PostgresStore(pool,{tenantPool}).init();store.close=async()=>{if(tenantPool!==pool)await tenantPool.end();await pool.end();};return store;}
  catch(error){if(tenantPool!==pool)await tenantPool.end().catch(()=>{});await pool.end().catch(()=>{});throw error;}
}

export {MIGRATIONS};

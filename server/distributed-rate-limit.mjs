import crypto from 'node:crypto';

export class PostgresFixedWindowRateLimiter{
  constructor(pool,{now=()=>Date.now(),cleanupEvery=250,hashKey=process.env.EINEIRO_RATE_LIMIT_HASH_KEY||'',hashKeyRequired=process.env.EINEIRO_DISTRIBUTED_RATE_LIMIT_REQUIRED==='true'}={}){
    if(!pool?.query)throw new Error('postgres pool required');if(hashKeyRequired&&Buffer.byteLength(String(hashKey))<32)throw Object.assign(new Error('rate limit hash key must contain at least 32 bytes'),{code:'RATE_LIMIT_HASH_KEY_REQUIRED'});
    this.pool=pool;this.now=now;this.cleanupEvery=Math.max(1,Number(cleanupEvery)||250);this.hashKey=String(hashKey||'');this.consumed=0;
  }

  async consume(key,{limit,windowMs}={}){
    const safeLimit=Math.max(1,Number(limit)||1);const safeWindow=Math.max(1000,Number(windowMs)||60_000);const now=this.now();
    const startedAt=Math.floor(now/safeWindow)*safeWindow;const resetAt=startedAt+safeWindow;
    const material=`${String(key)}:${startedAt}`;const bucketKey=this.hashKey?crypto.createHmac('sha256',this.hashKey).update(material).digest('hex'):crypto.createHash('sha256').update(material).digest('hex');
    let result;
    try{
      result=await this.pool.query(`INSERT INTO eineiro_rate_limits(bucket_key,count,reset_at)
        VALUES($1,1,$2)
        ON CONFLICT(bucket_key) DO UPDATE SET count=eineiro_rate_limits.count+1
        RETURNING count,reset_at`,[bucketKey,new Date(resetAt).toISOString()]);
      this.consumed++;
      if(this.consumed%this.cleanupEvery===0)await this.pool.query('DELETE FROM eineiro_rate_limits WHERE reset_at < now()');
    }catch(cause){
      throw Object.assign(new Error('rate limit backend unavailable'),{status:503,code:'RATE_LIMIT_BACKEND_UNAVAILABLE',cause});
    }
    const count=Number(result.rows?.[0]?.count||0);const databaseReset=Date.parse(result.rows?.[0]?.reset_at||resetAt)||resetAt;
    if(count>safeLimit)throw Object.assign(new Error('rate limit exceeded'),{status:429,code:'RATE_LIMITED',retryAfterMs:Math.max(1,databaseReset-now)});
    return{limit:safeLimit,remaining:Math.max(0,safeLimit-count),resetAt:databaseReset};
  }
}

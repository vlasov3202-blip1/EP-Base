import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable,Writable} from 'node:stream';

const dir=await mkdtemp(join(tmpdir(),'eineiro-market-more-'));
process.env.EINEIRO_DATA_FILE=join(dir,'data.json');
const {handleMarketApi}=await import('./market-api.mjs');

async function call(payload,{originProof=true}={}){
  const body=JSON.stringify(payload);
  const req=Readable.from([Buffer.from(body)]);
  req.method='POST';req.url='/api/market/events';req.headers={'content-type':'application/json','content-length':String(Buffer.byteLength(body)),...(originProof?{'x-eineiro-market-event':'1'}:{})};req.socket={remoteAddress:'127.0.0.44'};
  const chunks=[];
  const res=new Writable({write(chunk,_encoding,callback){chunks.push(Buffer.from(chunk));callback()}});
  res.writeHead=(status,headers={})=>{res.statusCode=status;res.headers=headers};
  const end=res.end.bind(res);res.end=chunk=>{if(chunk)chunks.push(Buffer.from(chunk));return end()};
  await handleMarketApi(req,res);await new Promise(resolve=>res.on('finish',resolve));
  return{status:res.statusCode,body:JSON.parse(Buffer.concat(chunks).toString())};
}

try{
  const accepted=await call({name:'more_opened',refs:{release_id:'api-test'}});
  assert.equal(accepted.status,202);assert.equal(accepted.body.accepted,true);assert.ok(accepted.body.eventId.startsWith('market_evt_'));
  const crossOrigin=await call({name:'more_opened'},{originProof:false});
  assert.equal(crossOrigin.status,403);assert.equal(crossOrigin.body.code,'MARKET_EVENT_ORIGIN_REQUIRED');
  const unsupported=await call({name:'showcase_opened'});
  assert.equal(unsupported.status,400);assert.equal(unsupported.body.code,'MARKET_EVENT_UNSUPPORTED');
  const unsafe=await call({name:'more_opened',refs:{context_id:'user@example.com'}});
  assert.equal(unsafe.status,400);assert.equal(unsafe.body.code,'MARKET_EVENT_INVALID');
  console.log('EINEIRO Market More API tests: OK');
}finally{await rm(dir,{recursive:true,force:true})}

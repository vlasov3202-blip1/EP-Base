import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {handleMarketApi} from './market-api.mjs';

process.env.VISION_KILL_SWITCH='true';
const req=Readable.from([Buffer.from('{"frames":[]}')]);req.method='POST';req.url='/api/vision/resolve';req.headers={'content-length':'13'};req.socket={remoteAddress:'127.0.0.1'};
const chunks=[];const res=new Writable({write(chunk,_encoding,callback){chunks.push(Buffer.from(chunk));callback()}});res.writeHead=status=>{res.statusCode=status};const end=res.end.bind(res);res.end=chunk=>{if(chunk)chunks.push(Buffer.from(chunk));return end()};
await handleMarketApi(req,res);await new Promise(resolve=>res.on('finish',resolve));
assert.equal(res.statusCode,503);assert.equal(JSON.parse(Buffer.concat(chunks).toString()).code,'VISION_DISABLED');
delete process.env.VISION_KILL_SWITCH;
console.log('EINEIRO Market API security tests: OK');

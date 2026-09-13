import assert from 'node:assert/strict';
import {AvitoAdapter} from './avito-adapter.mjs';

const calls=[];
const fetchImpl=async(url,opts={})=>{
  calls.push({url,opts});
  if(url.endsWith('/token'))return{ok:true,status:200,json:async()=>({access_token:'tok',expires_in:86400})};
  if(url.includes('/messenger/v2/accounts/123/chats?'))return{ok:true,status:200,json:async()=>({chats:[{id:'chat-1'}]})};
  if(url.includes('/messenger/v3/accounts/123/chats/chat-1/messages/'))return{ok:true,status:200,json:async()=>({messages:[{id:'m1',direction:'in',content:{text:'Здравствуйте'},created:1700000000}]})};
  if(url.includes('/messenger/v1/accounts/123/chats/chat-1/messages'))return{ok:true,status:200,json:async()=>({id:'m2'})};
  return{ok:false,status:404,json:async()=>({})};
};

const a=new AvitoAdapter({clientId:'id',clientSecret:'secret',userId:'123',fetchImpl});
const check=await a.checkConnection();assert.equal(check.ok,true);
const batch=await a.poll({});assert.equal(batch.items.length,1);assert.equal(batch.items[0].externalMessageId,'m1');assert.equal(batch.items[0].externalConversationId,'chat-1');
const sent=await a.sendMessage({message:{conversationId:'chat-1',text:'Ответ'}});assert.equal(sent.externalMessageId,'m2');
assert.equal(calls.filter(x=>x.url.endsWith('/token')).length,1,'token must be cached');
const sendCall=calls.find(x=>x.url.includes('/messenger/v1/accounts/123/chats/chat-1/messages'));const body=JSON.parse(sendCall.opts.body);assert.deepEqual(body,{type:'text',message:{text:'Ответ'}});
console.log('EINEIRO Avito adapter tests: OK');

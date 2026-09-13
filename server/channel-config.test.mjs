import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {JsonFileStore} from './storage.mjs';
import {ChannelConfigService,encryptJson,decryptJson} from './channel-config.mjs';

const dir=await mkdtemp(path.join(os.tmpdir(),'eineiro-channel-'));
const store=await new JsonFileStore(path.join(dir,'db.json')).init();
const cipherKey='temporary-test-key';
const service=new ChannelConfigService(store,{secret:cipherKey});
const first={companyId:'c1',userId:'u1',role:'owner'};
const second={companyId:'c2',userId:'u2',role:'owner'};

const sealed=encryptJson({value:'example'},cipherKey);
assert.notEqual(sealed.data,'example');
assert.deepEqual(decryptJson(sealed,cipherKey),{value:'example'});
const saved=await service.save(first,'avito',{credentials:{value:'example'},settings:{account:'one'}});
assert.equal(saved.configured,true);
assert.equal('credentials' in saved,false);
assert.deepEqual(await service.credentials(first,'avito'),{value:'example'});
assert.equal((await service.get(second,'avito')).configured,false);
const checked=await service.markCheck(first,'avito',{ok:true});
assert.equal(checked.status,'connected');
await service.disable(first,'avito');
assert.equal((await service.get(first,'avito')).status,'disabled');
await rm(dir,{recursive:true,force:true});
console.log('EINEIRO channel config tests: OK');

import path from 'node:path';
import {JsonFileStore} from './storage.mjs';
import {createPostgresStore} from './postgres-storage.mjs';

export async function createDataStore(){
  if(process.env.DATABASE_URL)return createPostgresStore(process.env.DATABASE_URL);
  const file=process.env.EINEIRO_DATA_FILE||path.join(process.cwd(),'data','eineiro.json');
  return new JsonFileStore(file).init();
}

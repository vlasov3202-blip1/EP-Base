import crypto from 'node:crypto';
import {assertCan} from './core.mjs';

const ITERATIONS=210000;
const KEYLEN=32;
const DIGEST='sha256';

export function normalizeEmail(email){return String(email||'').trim().toLowerCase();}
export function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){
  if(String(password).length<8) throw new Error('password too short');
  const hash=crypto.pbkdf2Sync(String(password),salt,ITERATIONS,KEYLEN,DIGEST).toString('hex');
  return {scheme:`pbkdf2-${DIGEST}`,iterations:ITERATIONS,salt,hash};
}
export function verifyPassword(password,record){
  if(!record?.salt||!record?.hash)return false;
  const candidate=crypto.pbkdf2Sync(String(password),record.salt,Number(record.iterations||ITERATIONS),KEYLEN,DIGEST);
  const expected=Buffer.from(record.hash,'hex');
  return expected.length===candidate.length&&crypto.timingSafeEqual(expected,candidate);
}

export class AuthService{
  constructor(store,{sessionTtlMs=1000*60*60*24*14}={}){this.store=store;this.sessionTtlMs=sessionTtlMs;}
  async register({companyId,userId,email,password,role='seller',name=''}){
    const normalized=normalizeEmail(email);if(!companyId||!userId||!normalized)throw new Error('companyId/userId/email required');
    if(this.store.findUserByEmail(companyId,normalized))throw Object.assign(new Error('email exists'),{code:'EMAIL_EXISTS'});
    const passwordHash=hashPassword(password);
    return this.store.putUser({id:userId,companyId,email:normalized,name,role,passwordHash,active:true,createdAt:new Date().toISOString()});
  }
  async login({companyId,email,password}){
    const user=this.store.findUserByEmail(companyId,normalizeEmail(email));
    if(!user||!user.active||!verifyPassword(password,user.passwordHash))throw Object.assign(new Error('invalid credentials'),{code:'INVALID_CREDENTIALS'});
    const session={id:crypto.randomBytes(32).toString('base64url'),companyId:user.companyId,userId:user.id,role:user.role,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+this.sessionTtlMs).toISOString(),lastSeenAt:new Date().toISOString()};
    await this.store.putSession(session);return {token:session.id,session:structuredClone(session),user:sanitizeUser(user)};
  }
  async authenticate(token){
    const session=this.store.getSession(String(token||''));
    if(!session)throw Object.assign(new Error('invalid session'),{code:'AUTH_REQUIRED'});
    if(Date.parse(session.expiresAt)<=Date.now()){await this.store.removeSession(session.id);throw Object.assign(new Error('session expired'),{code:'SESSION_EXPIRED'});}
    const user=this.store.getUser(session.companyId,session.userId);
    if(!user?.active)throw Object.assign(new Error('user inactive'),{code:'USER_INACTIVE'});
    return {userId:user.id,companyId:user.companyId,role:user.role,sessionId:session.id,user:sanitizeUser(user)};
  }
  async logout(token){await this.store.removeSession(String(token||''));}
  require(ctx,permission){assertCan(ctx,permission);return ctx;}
}

export function sanitizeUser(user){const {passwordHash,...safe}=user;return structuredClone(safe);}

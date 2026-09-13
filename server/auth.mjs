import crypto from 'node:crypto';
import {assertCan} from './core.mjs';

const ITERATIONS=210000;
const KEYLEN=32;
const DIGEST='sha256';
const INVITE_ROLES=new Set(['manager','seller','warehouse']);

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
function opaqueId(prefix){return `${prefix}_${crypto.randomUUID().replaceAll('-','')}`;}
function tokenHash(token){return crypto.createHash('sha256').update(String(token||'')).digest('hex');}

export class AuthService{
  constructor(store,{sessionTtlMs=1000*60*60*24*14}={}){this.store=store;this.sessionTtlMs=sessionTtlMs;}

  // Trusted/internal registration for migrations, fixtures and controlled server flows.
  async register({companyId,userId,email,password,role='seller',name='',identityId=null}){
    const normalized=normalizeEmail(email);if(!companyId||!userId||!normalized)throw new Error('companyId/userId/email required');
    if(await this.store.findUserByEmail(companyId,normalized))throw Object.assign(new Error('email exists'),{code:'EMAIL_EXISTS'});
    const passwordHash=hashPassword(password);
    const user=await this.store.putUser({id:userId,identityId:identityId||userId,companyId,email:normalized,name,role,passwordHash,active:true,createdAt:new Date().toISOString()});
    return sanitizeUser(user);
  }

  async createInvite(ctx,{email,role='seller',name='',expiresInMs=1000*60*60*24*7}={}){
    if(!ctx?.companyId||!['owner','admin'].includes(ctx.role))throw Object.assign(new Error('owner/admin required'),{status:403,code:'FORBIDDEN'});
    const normalized=normalizeEmail(email);if(!normalized)throw Object.assign(new Error('email required'),{status:400,code:'EMAIL_REQUIRED'});
    if(!INVITE_ROLES.has(role))throw Object.assign(new Error('invalid invite role'),{status:400,code:'INVALID_INVITE_ROLE'});
    if(await this.store.findUserByEmail(ctx.companyId,normalized))throw Object.assign(new Error('email exists'),{status:409,code:'EMAIL_EXISTS'});
    const token=crypto.randomBytes(32).toString('base64url');const id=tokenHash(token);const now=Date.now();
    const invitation={id,email:normalized,role,name:String(name||''),status:'pending',createdBy:ctx.userId||null,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+Math.max(60_000,Number(expiresInMs)||0)).toISOString()};
    await this.store.tenant({companyId:ctx.companyId}).put('Invitation',invitation);
    return {token,invitation:structuredClone(invitation)};
  }

  async registerPublic({email,password,name='',inviteToken=null}={}){
    const normalized=normalizeEmail(email);if(!normalized)throw Object.assign(new Error('email required'),{status:400,code:'EMAIL_REQUIRED'});
    if(inviteToken){
      const inviteId=tokenHash(inviteToken);let match=null;
      for(const companyId of await this.store.listCompanyIds()){
        const invitation=await this.store.tenant({companyId}).get('Invitation',inviteId);
        if(invitation){match={companyId,invitation};break;}
      }
      if(!match)throw Object.assign(new Error('invalid invite'),{status:400,code:'INVALID_INVITE'});
      const {companyId,invitation}=match;
      if(invitation.status!=='pending')throw Object.assign(new Error('invite already used'),{status:409,code:'INVITE_USED'});
      if(Date.parse(invitation.expiresAt)<=Date.now())throw Object.assign(new Error('invite expired'),{status:410,code:'INVITE_EXPIRED'});
      if(invitation.email!==normalized)throw Object.assign(new Error('invite email mismatch'),{status:403,code:'INVITE_EMAIL_MISMATCH'});
      if(await this.store.findUserByEmail(companyId,normalized))throw Object.assign(new Error('email exists'),{status:409,code:'EMAIL_EXISTS'});
      const user=await this.register({companyId,userId:opaqueId('usr'),identityId:opaqueId('idn'),email:normalized,password,role:invitation.role,name:name||invitation.name||''});
      await this.store.tenant({companyId}).put('Invitation',{...invitation,status:'redeemed',redeemedAt:new Date().toISOString(),redeemedUserId:user.id});
      return user;
    }
    const companyId=opaqueId('cmp');
    return this.register({companyId,userId:opaqueId('usr'),identityId:opaqueId('idn'),email:normalized,password,role:'owner',name});
  }

  async login({companyId,email,password}){
    const user=await this.store.findUserByEmail(companyId,normalizeEmail(email));
    if(!user||!user.active||!verifyPassword(password,user.passwordHash))throw Object.assign(new Error('invalid credentials'),{code:'INVALID_CREDENTIALS'});
    const identityId=user.identityId||user.id;
    const session={id:crypto.randomBytes(32).toString('base64url'),companyId:user.companyId,userId:user.id,identityId,role:user.role,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+this.sessionTtlMs).toISOString(),lastSeenAt:new Date().toISOString()};
    await this.store.putSession(session);return {token:session.id,session:structuredClone(session),user:sanitizeUser({...user,identityId})};
  }
  async authenticate(token){
    const session=await this.store.getSession(String(token||''));
    if(!session)throw Object.assign(new Error('invalid session'),{code:'AUTH_REQUIRED'});
    if(Date.parse(session.expiresAt)<=Date.now()){await this.store.removeSession(session.id);throw Object.assign(new Error('session expired'),{code:'SESSION_EXPIRED'});}
    const user=await this.store.getUser(session.companyId,session.userId);
    if(!user?.active)throw Object.assign(new Error('user inactive'),{code:'USER_INACTIVE'});
    const identityId=session.identityId||user.identityId||user.id;
    return {userId:user.id,identityId,companyId:user.companyId,role:user.role,sessionId:session.id,user:sanitizeUser({...user,identityId})};
  }
  async logout(token){await this.store.removeSession(String(token||''));}
  require(ctx,permission){assertCan(ctx,permission);return ctx;}
}

export function sanitizeUser(user){const {passwordHash,...safe}=user;return structuredClone(safe);}

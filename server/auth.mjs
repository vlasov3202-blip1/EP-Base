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
export function tokenHash(token){return crypto.createHash('sha256').update(String(token||'')).digest('hex');}

export class AuthService{
  constructor(store,{sessionTtlMs=1000*60*60*8,sessionIdleTtlMs=1000*60*30,loginWindowMs=1000*60*15,maxIdentityFailures=5,maxIpFailures=30,now=()=>Date.now()}={}){
    this.store=store;this.sessionTtlMs=sessionTtlMs;this.sessionIdleTtlMs=sessionIdleTtlMs;this.loginWindowMs=loginWindowMs;this.maxIdentityFailures=maxIdentityFailures;this.maxIpFailures=maxIpFailures;this.now=now;this.loginFailures=new Map();
  }

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

  async login({companyId,email,password,requestIp='unknown'}){
    const normalized=normalizeEmail(email);const identityKey=`identity:${companyId||'-'}:${normalized}`;const ipKey=`ip:${requestIp||'unknown'}`;
    this.assertLoginAllowed(identityKey,this.maxIdentityFailures);this.assertLoginAllowed(ipKey,this.maxIpFailures);
    const user=await this.store.findUserByEmail(companyId,normalized);
    if(!user||!user.active||!verifyPassword(password,user.passwordHash)){
      this.recordLoginFailure(identityKey);this.recordLoginFailure(ipKey);
      throw Object.assign(new Error('invalid credentials'),{status:401,code:'INVALID_CREDENTIALS'});
    }
    this.loginFailures.delete(identityKey);
    const identityId=user.identityId||user.id;
    const token=crypto.randomBytes(32).toString('base64url');const now=this.now();
    const session={id:tokenHash(token),companyId:user.companyId,userId:user.id,identityId,role:user.role,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+this.sessionTtlMs).toISOString(),lastSeenAt:new Date(now).toISOString(),reauthenticatedAt:null};
    await this.store.putSession(session);return {token,session:publicSession(session),user:sanitizeUser({...user,identityId})};
  }
  async authenticate(token){
    const sessionKey=tokenHash(token);const session=await this.store.getSession(sessionKey);
    if(!session)throw Object.assign(new Error('invalid session'),{code:'AUTH_REQUIRED'});
    const now=this.now();
    if(Date.parse(session.expiresAt)<=now||Date.parse(session.lastSeenAt||session.createdAt)+this.sessionIdleTtlMs<=now){await this.store.removeSession(sessionKey);throw Object.assign(new Error('session expired'),{code:'SESSION_EXPIRED'});}
    const user=await this.store.getUser(session.companyId,session.userId);
    if(!user?.active)throw Object.assign(new Error('user inactive'),{code:'USER_INACTIVE'});
    if(now-Date.parse(session.lastSeenAt||session.createdAt)>=60_000){session.lastSeenAt=new Date(now).toISOString();await this.store.putSession(session);}
    const identityId=session.identityId||user.identityId||user.id;
    return {userId:user.id,identityId,companyId:user.companyId,role:user.role,sessionId:session.id,reauthenticatedAt:session.reauthenticatedAt||null,user:sanitizeUser({...user,identityId})};
  }
  async reauthenticate(token,{password,requestIp='unknown'}={}){
    const ctx=await this.authenticate(token);const identityKey=`reauth:${ctx.companyId}:${ctx.userId}`;const ipKey=`reauth-ip:${requestIp||'unknown'}`;
    this.assertLoginAllowed(identityKey,this.maxIdentityFailures);this.assertLoginAllowed(ipKey,this.maxIpFailures);
    const user=await this.store.getUser(ctx.companyId,ctx.userId);
    if(!user?.active||!verifyPassword(password,user.passwordHash)){this.recordLoginFailure(identityKey);this.recordLoginFailure(ipKey);throw Object.assign(new Error('re-authentication failed'),{status:401,code:'REAUTH_FAILED'});}
    this.loginFailures.delete(identityKey);const sessionKey=tokenHash(token);const session=await this.store.getSession(sessionKey);const now=this.now();session.reauthenticatedAt=new Date(now).toISOString();await this.store.putSession(session);return{reauthenticatedAt:session.reauthenticatedAt,validUntil:new Date(now+10*60*1000).toISOString()};
  }
  requireRecentReauthentication(ctx,{maxAgeMs=10*60*1000}={}){const at=Date.parse(ctx?.reauthenticatedAt||'');if(!Number.isFinite(at)||this.now()-at>Math.max(1,Number(maxAgeMs)||0))throw Object.assign(new Error('recent re-authentication required'),{status:428,code:'REAUTH_REQUIRED'});return ctx;}
  async logout(token){await this.store.removeSession(tokenHash(token));}
  require(ctx,permission){assertCan(ctx,permission);return ctx;}
  assertLoginAllowed(key,limit){
    const now=this.now();const attempts=(this.loginFailures.get(key)||[]).filter(at=>now-at<this.loginWindowMs);this.loginFailures.set(key,attempts);
    if(attempts.length>=limit)throw Object.assign(new Error('too many login attempts'),{status:429,code:'LOGIN_RATE_LIMITED',retryAfterMs:Math.max(1,this.loginWindowMs-(now-attempts[0]))});
  }
  recordLoginFailure(key){const now=this.now();const attempts=(this.loginFailures.get(key)||[]).filter(at=>now-at<this.loginWindowMs);attempts.push(now);this.loginFailures.set(key,attempts);}
}

export function sanitizeUser(user){const {passwordHash,...safe}=user;return structuredClone(safe);}
function publicSession(session){const {id,...safe}=session;return structuredClone(safe);}

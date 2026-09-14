import crypto from 'node:crypto';
import {assertCan} from './core.mjs';

const ITERATIONS=210000;
const KEYLEN=32;
const DIGEST='sha256';
const INVITE_ROLES=new Set(['manager','seller','warehouse']);
const CHALLENGE_TTL={EMAIL_VERIFY:1000*60*60*24,PASSWORD_RESET:1000*60*20};

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
  constructor(store,{sessionTtlMs=1000*60*60*8,sessionIdleTtlMs=1000*60*30,loginWindowMs=1000*60*15,maxIdentityFailures=5,maxIpFailures=30,challengeCooldownMs=60_000,requireEmailVerification=true,notifier=async()=>{},now=()=>Date.now()}={}){
    this.store=store;this.sessionTtlMs=sessionTtlMs;this.sessionIdleTtlMs=sessionIdleTtlMs;this.loginWindowMs=loginWindowMs;this.maxIdentityFailures=maxIdentityFailures;this.maxIpFailures=maxIpFailures;this.challengeCooldownMs=challengeCooldownMs;this.requireEmailVerification=requireEmailVerification;this.notifier=notifier;this.now=now;this.loginFailures=new Map();this.challengeIssues=new Map();
  }

  // Trusted/internal registration for migrations, fixtures and controlled server flows.
  async register({companyId,userId,email,password,role='seller',name='',identityId=null}){
    const normalized=normalizeEmail(email);if(!companyId||!userId||!normalized)throw new Error('companyId/userId/email required');
    if(await this.store.findUserByEmail(companyId,normalized))throw Object.assign(new Error('email exists'),{code:'EMAIL_EXISTS'});
    const passwordHash=hashPassword(password);
    const user=await this.store.putUser({id:userId,identityId:identityId||userId,companyId,email:normalized,name,role,passwordHash,active:true,createdAt:new Date().toISOString()});
    return sanitizeUser(user);
  }

  async registerBuyer({email,password,name='',locale='ru-RU'}={}){
    const normalized=normalizeEmail(email);if(!normalized)throw Object.assign(new Error('email required'),{status:400,code:'EMAIL_REQUIRED'});
    if(await this.store.findAuthAccountByEmail(normalized))throw Object.assign(new Error('email exists'),{status:409,code:'EMAIL_EXISTS'});
    const now=new Date(this.now()).toISOString();const identityId=opaqueId('idn');
    await this.store.putIdentity({id:identityId,status:'active',displayName:String(name||''),locale,profile:{type:'buyer',preferences:{},privacy:{personalization:true,marketing:false}},createdAt:now,updatedAt:now});
    const account=await this.store.putAuthAccount({identityId,email:normalized,name:String(name||''),passwordHash:hashPassword(password),emailStatus:'unverified',emailVerifiedAt:null,active:true,authMethods:['password'],createdAt:now,updatedAt:now});
    await this.authEvent(identityId,'IDENTITY_REGISTERED');
    await this.createChallenge(account,'EMAIL_VERIFY');
    return publicBuyer(account);
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
      let account=await this.store.findAuthAccountByEmail(normalized);
      if(account&&!verifyPassword(password,account.passwordHash))throw Object.assign(new Error('invalid credentials'),{status:401,code:'INVALID_CREDENTIALS'});
      if(!account){await this.registerBuyer({email:normalized,password,name:name||invitation.name||''});account=await this.store.findAuthAccountByEmail(normalized);}
      const user=await this.store.putUser({id:opaqueId('usr'),identityId:account.identityId,companyId,email:normalized,name:name||invitation.name||account.name||'',role:invitation.role,passwordHash:account.passwordHash,active:true,createdAt:new Date(this.now()).toISOString()});
      await this.store.tenant({companyId}).put('CompanyMembership',{id:`membership:${account.identityId}:${companyId}:${invitation.role}`,identityId:account.identityId,companyId,role:invitation.role,capabilities:[],status:'active',createdAt:new Date(this.now()).toISOString()});
      await this.store.tenant({companyId}).put('Invitation',{...invitation,status:'redeemed',redeemedAt:new Date().toISOString(),redeemedUserId:user.id});
      return sanitizeUser(user);
    }
    return this.registerBuyer({email:normalized,password,name});
  }

  async login({companyId,email,password,requestIp='unknown'}){
    const normalized=normalizeEmail(email);const identityKey=`identity:${companyId||'-'}:${normalized}`;const ipKey=`ip:${requestIp||'unknown'}`;
    this.assertLoginAllowed(identityKey,this.maxIdentityFailures);this.assertLoginAllowed(ipKey,this.maxIpFailures);
    const user=companyId?await this.store.findUserByEmail(companyId,normalized):await this.store.findAuthAccountByEmail(normalized);
    const credential=companyId&&user?.identityId?await this.store.getAuthAccount(user.identityId)||user:user;
    if(!user||!user.active||!credential?.active||!verifyPassword(password,credential.passwordHash)){
      this.recordLoginFailure(identityKey);this.recordLoginFailure(ipKey);
      throw Object.assign(new Error('invalid credentials'),{status:401,code:'INVALID_CREDENTIALS'});
    }
    if(this.requireEmailVerification&&credential.emailStatus!=null&&credential.emailStatus!=='verified')throw Object.assign(new Error('email verification required'),{status:403,code:'EMAIL_VERIFICATION_REQUIRED'});
    this.loginFailures.delete(identityKey);
    const buyerLogin=!companyId;const identityId=user.identityId||user.id;
    const token=crypto.randomBytes(32).toString('base64url');const now=this.now();
    const session={id:tokenHash(token),publicId:opaqueId('ses'),accountType:buyerLogin?'identity':'business',companyId:buyerLogin?null:user.companyId,userId:buyerLogin?identityId:user.id,identityId,role:buyerLogin?'buyer':user.role,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+this.sessionTtlMs).toISOString(),lastSeenAt:new Date(now).toISOString(),reauthenticatedAt:null};
    await this.store.putSession(session);await this.authEvent(identityId,'LOGIN_SUCCEEDED',{accountType:session.accountType});
    const memberships=await this.membershipsForIdentity(identityId);
    return {token,session:publicSession(session),user:buyerLogin?publicBuyer(user):sanitizeUser({...user,identityId}),memberships,activeContext:buyerLogin?null:{companyId:user.companyId,role:user.role}};
  }
  async authenticate(token){
    const sessionKey=tokenHash(token);const session=await this.store.getSession(sessionKey);
    if(!session)throw Object.assign(new Error('invalid session'),{code:'AUTH_REQUIRED'});
    const now=this.now();
    if(Date.parse(session.expiresAt)<=now||Date.parse(session.lastSeenAt||session.createdAt)+this.sessionIdleTtlMs<=now){await this.store.removeSession(sessionKey);throw Object.assign(new Error('session expired'),{code:'SESSION_EXPIRED'});}
    const user=session.accountType==='identity'?await this.store.getAuthAccount(session.identityId):await this.store.getUser(session.companyId,session.userId);
    if(!user?.active)throw Object.assign(new Error('user inactive'),{code:'USER_INACTIVE'});
    if(now-Date.parse(session.lastSeenAt||session.createdAt)>=60_000){session.lastSeenAt=new Date(now).toISOString();await this.store.putSession(session);}
    const identityId=session.identityId||user.identityId||user.id;
    return {userId:session.userId,identityId,companyId:session.companyId||null,role:session.role,sessionId:session.id,sessionPublicId:session.publicId,reauthenticatedAt:session.reauthenticatedAt||null,user:session.accountType==='identity'?publicBuyer(user):sanitizeUser({...user,identityId})};
  }
  async reauthenticate(token,{password,requestIp='unknown'}={}){
    const ctx=await this.authenticate(token);const identityKey=`reauth:${ctx.companyId}:${ctx.userId}`;const ipKey=`reauth-ip:${requestIp||'unknown'}`;
    this.assertLoginAllowed(identityKey,this.maxIdentityFailures);this.assertLoginAllowed(ipKey,this.maxIpFailures);
    const session=await this.store.getSession(tokenHash(token));const scopedUser=session?.accountType==='identity'?null:await this.store.getUser(ctx.companyId,ctx.userId);const user=await this.store.getAuthAccount(ctx.identityId)||scopedUser;
    if(!user?.active||!verifyPassword(password,user.passwordHash)){this.recordLoginFailure(identityKey);this.recordLoginFailure(ipKey);throw Object.assign(new Error('re-authentication failed'),{status:401,code:'REAUTH_FAILED'});}
    this.loginFailures.delete(identityKey);const now=this.now();session.reauthenticatedAt=new Date(now).toISOString();await this.store.putSession(session);await this.authEvent(ctx.identityId,'STEP_UP_SUCCEEDED');return{reauthenticatedAt:session.reauthenticatedAt,validUntil:new Date(now+10*60*1000).toISOString()};
  }
  requireRecentReauthentication(ctx,{maxAgeMs=10*60*1000}={}){const at=Date.parse(ctx?.reauthenticatedAt||'');if(!Number.isFinite(at)||this.now()-at>Math.max(1,Number(maxAgeMs)||0))throw Object.assign(new Error('recent re-authentication required'),{status:428,code:'REAUTH_REQUIRED'});return ctx;}
  async logout(token){await this.store.removeSession(tokenHash(token));}
  async requestEmailVerification({email}={}){const account=await this.store.findAuthAccountByEmail(normalizeEmail(email));if(account&&account.active&&!account.emailVerifiedAt)await this.createChallenge(account,'EMAIL_VERIFY',{suppressRateError:true});return{accepted:true};}
  async verifyEmail(token){return this.consumeChallenge(token,'EMAIL_VERIFY',async account=>{const now=new Date(this.now()).toISOString();const next={...account,emailStatus:'verified',emailVerifiedAt:now,updatedAt:now};await this.store.putAuthAccount(next);await this.authEvent(account.identityId,'EMAIL_VERIFIED');return publicBuyer(next);});}
  async requestPasswordReset({email}={}){const account=await this.store.findAuthAccountByEmail(normalizeEmail(email));if(account?.active)await this.createChallenge(account,'PASSWORD_RESET',{suppressRateError:true});return{accepted:true};}
  async resetPassword({token,password}={}){return this.consumeChallenge(token,'PASSWORD_RESET',async account=>{const now=new Date(this.now()).toISOString();const next={...account,passwordHash:hashPassword(password),updatedAt:now,passwordChangedAt:now};await this.store.putAuthAccount(next);await this.revokeAllSessions(account.identityId,{reason:'password_reset'});await this.authEvent(account.identityId,'PASSWORD_RESET_COMPLETED');return{reset:true};});}
  async listSessions(identityId){const rows=await this.store.listSessionsByIdentity(identityId);return rows.map(publicSession);}
  async revokeSession(identityId,publicId,{reason='user'}={}){const rows=await this.store.listSessionsByIdentity(identityId);const target=rows.find(x=>x.publicId===publicId);if(!target)throw Object.assign(new Error('session not found'),{status:404,code:'SESSION_NOT_FOUND'});await this.store.removeSession(target.id);await this.authEvent(identityId,'SESSION_REVOKED',{reason});return{revoked:true};}
  async revokeAllSessions(identityId,{reason='user'}={}){const rows=await this.store.listSessionsByIdentity(identityId);for(const session of rows)await this.store.removeSession(session.id);await this.authEvent(identityId,'SESSIONS_REVOKED',{reason,count:rows.length});return{revoked:rows.length};}
  async membershipsForIdentity(identityId){const memberships=[];for(const companyId of await this.store.listCompanyIds()){const repo=this.store.tenant({companyId});for(const row of await repo.list('CompanyMembership'))if(row.identityId===identityId&&row.status==='active')memberships.push({companyId:row.companyId,role:row.role,capabilities:row.capabilities||[]});}return memberships;}
  require(ctx,permission){assertCan(ctx,permission);return ctx;}
  assertLoginAllowed(key,limit){
    const now=this.now();const attempts=(this.loginFailures.get(key)||[]).filter(at=>now-at<this.loginWindowMs);this.loginFailures.set(key,attempts);
    if(attempts.length>=limit)throw Object.assign(new Error('too many login attempts'),{status:429,code:'LOGIN_RATE_LIMITED',retryAfterMs:Math.max(1,this.loginWindowMs-(now-attempts[0]))});
  }
  recordLoginFailure(key){const now=this.now();const attempts=(this.loginFailures.get(key)||[]).filter(at=>now-at<this.loginWindowMs);attempts.push(now);this.loginFailures.set(key,attempts);}
  async createChallenge(account,type,{suppressRateError=false}={}){const now=this.now();const key=`${type}:${account.identityId}`;const last=this.challengeIssues.get(key);if(last!=null&&now-last<this.challengeCooldownMs){if(suppressRateError)return null;throw Object.assign(new Error('challenge rate limited'),{status:429,code:'CHALLENGE_RATE_LIMITED',retryAfterMs:this.challengeCooldownMs-(now-last)});}this.challengeIssues.set(key,now);const token=crypto.randomBytes(32).toString('base64url');const challenge={id:tokenHash(token),identityId:account.identityId,type,status:'pending',createdAt:new Date(now).toISOString(),expiresAt:new Date(now+CHALLENGE_TTL[type]).toISOString(),usedAt:null};await this.store.putAuthChallenge(challenge);try{await this.notifier({type,email:account.email,token,expiresAt:challenge.expiresAt});await this.authEvent(account.identityId,`${type}_ISSUED`);}catch{await this.authEvent(account.identityId,`${type}_DELIVERY_FAILED`);}return{expiresAt:challenge.expiresAt};}
  async consumeChallenge(token,type,action){const id=tokenHash(token);const challenge=await this.store.claimAuthChallenge(id,type,this.now());if(!challenge)throw Object.assign(new Error('invalid or expired token'),{status:400,code:'INVALID_OR_EXPIRED_TOKEN'});const account=await this.store.getAuthAccount(challenge.identityId);if(!account?.active)throw Object.assign(new Error('invalid or expired token'),{status:400,code:'INVALID_OR_EXPIRED_TOKEN'});try{const result=await action(account);await this.store.putAuthChallenge({...challenge,status:'used'});return result;}catch(error){await this.store.putAuthChallenge({...challenge,status:'pending',usedAt:null});throw error;}}
  async authEvent(identityId,type,details={}){await this.store.appendAuthEvent({id:opaqueId('aevt'),identityId,type,details:structuredClone(details),at:new Date(this.now()).toISOString()});}
}

export function sanitizeUser(user){const {passwordHash,...safe}=user;return structuredClone(safe);}
function publicBuyer(account){return{id:account.identityId,identityId:account.identityId,companyId:null,role:'buyer',email:account.email,name:account.name||'',emailStatus:account.emailStatus||'unverified',emailVerifiedAt:account.emailVerifiedAt||null,active:Boolean(account.active),createdAt:account.createdAt};}
function publicSession(session){const {id,...safe}=session;return structuredClone(safe);}

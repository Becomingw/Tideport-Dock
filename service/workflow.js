/** Shared request records. Approval is not storage provisioning. */
import { DatabaseSync } from 'node:sqlite'
import { randomUUID, createHash } from 'node:crypto'
import { mkdirSync, chmodSync } from 'node:fs'
import { dirname } from 'node:path'
import { fail, requestText as text, requestFields as allowed, validateApplication } from '../lib/request-schema.js'
export { fail, validateApplication } from '../lib/request-schema.js'
export const digest = token => createHash('sha256').update(token).digest('hex')
export class Workflow {
  constructor(path) {
    if (path!==':memory:') mkdirSync(dirname(path),{recursive:true,mode:0o700})
    this.db = new DatabaseSync(path)
    if(path!==':memory:') chmodSync(path,0o600)
    this.db.exec(`PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS principals(id TEXT PRIMARY KEY, role TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, applicant TEXT NOT NULL, client_id TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload TEXT NOT NULL, events TEXT NOT NULL, UNIQUE(applicant,client_id));`)
  }
  close(){this.db.close()}
  enroll(id,role,token) {
    text(id,'principal',100)
    if(!['user','admin'].includes(role) || typeof token!=='string' || token.length<32) fail('Invalid principal credentials')
    this.db.prepare('INSERT INTO principals VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET role=excluded.role, token_hash=excluded.token_hash').run(id,role,digest(token))
  }
  authenticate(token) {
    if(typeof token!=='string' || token.length<32 || token.length>512) fail('Unauthorized',401)
    const user=this.db.prepare('SELECT id,role FROM principals WHERE token_hash=?').get(digest(token))
    if(!user) fail('Unauthorized',401)
    return user
  }
  decode(row) { return row ? {...row,payload:JSON.parse(row.payload),events:JSON.parse(row.events)} : null }
  get(user,id) {
    const row=this.decode(this.db.prepare('SELECT * FROM requests WHERE id=?').get(id))
    if(!row || user.role!=='admin' && row.applicant!==user.id) fail('Request not found',404)
    return row
  }
  list(user,body={}) {
    allowed(body,['before','limit'])
    const limit=body.limit ?? 50
    if(!Number.isInteger(limit)||limit<1||limit>100) fail('Invalid limit')
    const before=body.before ?? '9999'
    if(typeof before!=='string'||before.length>80) fail('Invalid cursor')
    const rows=user.role==='admin' ? this.db.prepare('SELECT * FROM requests WHERE id < ? ORDER BY id DESC LIMIT ?').all(before,limit+1) : this.db.prepare('SELECT * FROM requests WHERE applicant=? AND id < ? ORDER BY id DESC LIMIT ?').all(user.id,before,limit+1)
    return {requests:rows.slice(0,limit).map(r=>this.decode(r)),nextCursor:rows.length>limit?rows[limit-1].id:null}
  }
  submit(user,body) {
    const payload=validateApplication(body)
    const previous=this.decode(this.db.prepare('SELECT * FROM requests WHERE applicant=? AND client_id=?').get(user.id,payload.clientId))
    if(previous) { if(JSON.stringify(previous.payload)!==JSON.stringify(payload)) fail('Idempotency key already used',409); return previous }
    const now=new Date().toISOString(), id=`${now}-${randomUUID()}`
    const events=[{at:now,actor:user.id,action:'submitted',note:''}]
    this.db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?,?,?,?)').run(id,user.id,payload.clientId,1,'submitted',now,now,JSON.stringify(payload),JSON.stringify(events))
    return this.get(user,id)
  }
  transition(user,body) {
    allowed(body,['id','version','action','note','delivery'])
    const row=this.get(user,text(body.id,'id',80))
    if(!Number.isInteger(body.version)||body.version!==row.version) fail('Request changed; refresh before acting',409)
    const note=text(body.note ?? '','note',3000,body.action==='cancel')
    let status
    if(body.action==='cancel') {
      if(row.applicant!==user.id || row.status!=='submitted') fail('Only the applicant can cancel a pending request',403)
      status='cancelled'
    } else {
      if(user.role!=='admin') fail('Administrator required',403)
      const transitions={approve:['submitted','approved'],reject:['submitted','rejected'],start:['approved','processing'],fail:['processing','failed'],retry:['failed','processing'],deliver:['processing','delivered']}
      const step=transitions[body.action]
      if(!step || row.status!==step[0]) fail('Invalid state transition',409)
      status=step[1]
    }
    let delivery
    if(body.action==='deliver') {
      allowed(body.delivery,['verified','evidence','endpoint','owner','placement','quotaGiB','permissions'])
      if(body.delivery.verified!==true) fail('Verified delivery evidence required')
      delivery={verified:true}
      for(const key of ['evidence','endpoint','owner','placement','permissions']) delivery[key]=text(body.delivery[key],key,3000)
      let url; try { url=new URL(delivery.endpoint) } catch { fail('Invalid delivery endpoint') }
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search) fail('Invalid delivery endpoint')
      if(!Number.isSafeInteger(body.delivery.quotaGiB)||body.delivery.quotaGiB<=0) fail('Invalid delivered quota')
      delivery.quotaGiB=body.delivery.quotaGiB
    } else if(body.delivery!==undefined) fail('Delivery is only accepted on deliver')
    const now=new Date().toISOString(), events=[...row.events,{at:now,actor:user.id,action:body.action,note,...(delivery?{delivery}:{})}]
    // Compare-and-swap also protects concurrent reviewers using separate processes.
    const result=this.db.prepare('UPDATE requests SET version=version+1,status=?,updated_at=?,events=? WHERE id=? AND version=?').run(status,now,JSON.stringify(events),row.id,row.version)
    if(!result.changes) fail('Request changed; refresh before acting',409)
    return this.get(user,row.id)
  }
}

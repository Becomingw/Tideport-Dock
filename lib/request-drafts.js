/** The existing lab workflow: private local application -> manual handoff. */
import { readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { validateApplication, requestText, fail } from './request-schema.js'
export function applicationText(row) {
 const p=row.payload
 return [
  `OSS ${({bucket:'建桶',access:'权限',quota:'配额调整'})[p.kind]}申请`,
  `申请单编号：${row.id}`,
  `JMS 用户名：${row.applicant}（供管理员人工核对）`,
  `桶名：${p.bucket}`,`用途：${p.purpose}`,
  `目标配额：${p.quotaGiB===null?'沿用现有桶配额':p.quotaGiB+' GiB'}`,
  `期望阵列：${p.placement||'沿用现有桶放置'}`,
  `授权范围：${p.prefix||'整个桶'}`,`权限：${p.permissions.join(' / ')}`,
  `有效期：${p.validUntil}`,`共享与删除负责人：${p.sharing||'待管理员与申请人确认'}`,
  `当前 S3 入口：${row.endpoint}`,
  '',
  '请管理员核对身份、容量及授权范围后办理；Write 同时包含 DeleteObject 权限。',
  '交付请提供：桶名、Owner、配额、成员/前缀/权限、实际阵列和磁盘、S3 入口、验收时间与结果。',
  '本单为申请材料，不代表审批通过或已开通。',
 ].join('\n')
}
export class RequestDrafts {
 constructor(store) {this.store=store;this.path=join(dirname(store.path),'request-drafts.json')}
 read() {
  try{const rows=JSON.parse(readFileSync(this.path,'utf8'));if(!Array.isArray(rows))fail('申请单文件格式无效',500);return rows}
  catch(e){if(e.code==='ENOENT')return [];throw e}
 }
 list() {
  const {endpoint,profile}=this.store.current
  return {requests:this.read().filter(r=>r.endpoint===endpoint&&r.profile===profile).reverse().map(r=>({...r,text:applicationText(r)})),nextCursor:null}
 }
 create(body) {
  const {applicant,...data}=body
  const user=requestText(applicant,'JMS username',100),payload=validateApplication(data)
  const {endpoint,profile}=this.store.current,rows=this.read()
  const previous=rows.find(r=>r.endpoint===endpoint&&r.profile===profile&&r.payload.clientId===payload.clientId)
  if(previous) {if(previous.applicant!==user||JSON.stringify(previous.payload)!==JSON.stringify(payload))fail('申请内容已变化，请新建申请单',409);return {...previous,text:applicationText(previous)}}
  if(rows.length>=200)fail('本机申请单已达 200 条上限，请先归档申请单文件',409)
  const now=new Date().toISOString()
  const row={id:randomUUID(),local:true,status:'draft',applicant:user,payload,endpoint,profile,created_at:now,events:[{at:now,actor:user,action:'local_saved',note:'仅保存到本机，尚未发送给管理员。'}]}
  mkdirSync(dirname(this.path),{recursive:true,mode:0o700})
  const tmp=`${this.path}.${randomUUID()}.tmp`
  writeFileSync(tmp,JSON.stringify([...rows,row],null,2),{mode:0o600,flag:'wx'});renameSync(tmp,this.path)
  return {...row,text:applicationText(row)}
 }
}

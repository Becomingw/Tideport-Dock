/** Private service credentials are independent from S3 credentials and UI roles. */
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
const fail = (message,status=503) => { throw Object.assign(new Error(message),{status}) }
export function requestServiceURL(value) {
  let url
  try { url=new URL(value) } catch { fail('申请服务地址无效',400) }
  if (url.username || url.password || url.search || url.hash || !(url.protocol==='https:' || url.protocol==='http:' && ['127.0.0.1','[::1]','localhost'].includes(url.hostname))) fail('申请服务需要 HTTPS（本机测试可用 HTTP）',400)
  return url.href.replace(/\/$/,'')
}
export class RequestsClient {
  constructor(path=join(homedir(),'.config','osslab','requests.json')) { this.path=path }
  credentials() {
    let file
    try { file=statSync(this.path) } catch { fail('申请服务尚未配置。需要管理员部署服务并私密发放个人 requests.json；OSS 网页地址不能直接作为申请接口。') }
    if(!file.isFile() || (file.mode & 0o077)) fail('申请凭据文件权限必须为 0600')
    let config
    try { config=JSON.parse(readFileSync(this.path,'utf8')) } catch { fail('申请凭据文件格式无效') }
    if(typeof config.token!=='string'||!/^[A-Za-z0-9_-]{32,512}$/.test(config.token)) fail('申请凭据无效')
    return {url:requestServiceURL(config.url),token:config.token}
  }
  async call(action,body={},signal) {
    const paths={session:'session',list:'requests/list',submit:'requests/submit',change:'requests/change'}
    if(!paths[action]) fail('Unknown request operation',400)
    const {url,token}=this.credentials()
    let response
    try { response=await fetch(`${url}/v1/${paths[action]}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(body),redirect:'error',signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000)}) }
    catch { fail('无法连接申请服务，请检查服务地址、网络与 TLS 信任配置。',502) }
    if(!response.ok) { await response.body?.cancel(); fail(({401:'申请服务身份验证失败，请联系管理员更新个人凭据。',403:'申请服务拒绝此操作：当前身份无审批权限。',409:'申请状态已变化或重复提交内容不一致，请刷新后检查。',400:'申请字段或交付记录不完整，请检查填写内容。',404:'申请服务接口或记录不存在，请核对服务部署。'})[response.status] || '申请服务暂时不可用',response.status===404?502:response.status) }
    const chunks=[]; let size=0
    for await(const chunk of response.body) {size+=chunk.length;if(size>2*1024*1024) fail('申请服务响应过大',502);chunks.push(chunk)}
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { fail('申请服务响应格式无效',502) }
  }
}

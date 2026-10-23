/** Shared application validation; no service or SQLite dependency. */
export const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }) }
export const requestText = (v, name, max=1000, optional=false) => {
  if (typeof v !== 'string' || v.length > max || /[\x00-\x1f]/.test(v) || (!optional && !v.trim())) fail(`Invalid ${name}`)
  return v.trim()
}
export const requestFields = (body, fields) => { if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k=>!fields.includes(k))) fail('Unknown or invalid fields') }
export function validateApplication(body) {
  requestFields(body,['kind','bucket','purpose','quotaGiB','placement','prefix','permissions','validUntil','sharing','clientId'])
  if (!['bucket','access','quota'].includes(body.kind)) fail('Invalid request kind')
  const data = {kind:body.kind}
  data.bucket=requestText(body.bucket,'bucket',63)
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(data.bucket) || data.bucket.includes('..') || /^\d+\.\d+\.\d+\.\d+$/.test(data.bucket)) fail('Invalid bucket')
  for (const key of ['purpose','placement','prefix','validUntil','sharing']) data[key]=requestText(body[key] ?? '',key,1000,['prefix','sharing'].includes(key) || key==='placement' && body.kind!=='bucket')
  if (data.prefix.startsWith('/') || data.prefix.split('/').includes('..')) fail('Invalid prefix')
  if (!Array.isArray(body.permissions) || !body.permissions.length || body.permissions.some(p=>!['Read','List','Write'].includes(p))) fail('Invalid permissions')
  data.permissions=[...new Set(body.permissions)]
  if (body.kind!=='access' && (!Number.isSafeInteger(body.quotaGiB) || body.quotaGiB<=0 || body.quotaGiB>1e9)) fail('Invalid quotaGiB')
  data.quotaGiB=body.kind==='access' ? null : body.quotaGiB
  data.clientId=requestText(body.clientId,'clientId',80)
  return data
}

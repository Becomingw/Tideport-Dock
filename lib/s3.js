/** Bounded S3 metadata requests. Transfers remain in rclone. */
import { Agent } from 'node:https'
import { readFileSync } from 'node:fs'
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3'
import { fromIni } from '@aws-sdk/credential-providers'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { inspectCredentials, resolveTarget } from './config.js'

const invalid = message => Object.assign(new TypeError(message), { status: 400 })

export function pageLimit(value, config) {
  const limit = value ?? 200
  if (!Number.isInteger(limit) || limit < 1 || limit > Math.min(1000, config.maxListEntries)) {
    throw invalid(`limit must be an integer in 1..${Math.min(1000, config.maxListEntries)}`)
  }
  return limit
}

export function createClient(config) {
  const credentials = inspectCredentials(config)
  if (!credentials.ok) throw Object.assign(new Error(credentials.problem), { status: 401 })
  return new S3Client({
    endpoint: config.endpoint, region: config.region, forcePathStyle: true, maxAttempts: 3,
    credentials: fromIni({ profile: config.profile, filepath: config.credentialsPath, configFilepath: '/dev/null', ignoreCache: true }),
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 5000, requestTimeout: 30000,
      httpsAgent: new Agent({
        rejectUnauthorized: config.caBundle ? true : !config.insecureTLS,
        ...(config.caBundle ? { ca: readFileSync(config.caBundle) } : {}),
      }),
    }),
  })
}

export function metadataError(error) {
  const codes = new Set(['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ESOCKETTIMEDOUT','ENOTFOUND','EAI_AGAIN','EHOSTUNREACH','ENETUNREACH','EACCES','EPERM','ERR_INVALID_PROTOCOL','ERR_INVALID_ARG_TYPE','ERR_TLS_CERT_ALTNAME_INVALID','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','ERR_SSL_WRONG_VERSION_NUMBER'])
  const names = new Set(['CredentialsProviderError','TokenProviderError','AccessDenied','InvalidAccessKeyId','SignatureDoesNotMatch','ExpiredToken','RequestTimeTooSkewed','TimeoutError','AbortError'])
  const queue=[error],seen=new Set(); let code
  while(queue.length && seen.size<12) {
    const item=queue.shift();if(!item||seen.has(item))continue;seen.add(item)
    code=codes.has(item.code)?item.code:names.has(item.name)?item.name:null
    if(code)break
    const message=String(item.message||'')
    code=[...codes].find(c=>message.includes(c))
    if(!code && /proxy/i.test(message))code='PROXY_ERROR'
    if(!code && /certificate|self.signed/i.test(message))code='TLS_CERTIFICATE_ERROR'
    if(!code && /credential|profile/i.test(message))code='CREDENTIAL_PROVIDER_ERROR'
    if(!code && /permission|not permitted|denied/i.test(message))code='PERMISSION_ERROR'
    if(code)break
    queue.push(item.cause,...(Array.isArray(item.errors)?item.errors:[]))
  }
  const status=error.$metadata?.httpStatusCode
  const hints={TLS_CERTIFICATE_ERROR:'TLS 证书验证失败',PROXY_ERROR:'宿主代理连接失败',CREDENTIAL_PROVIDER_ERROR:'无法加载个人凭据',CredentialsProviderError:'无法加载个人凭据',EPERM:'宿主网络访问被系统拒绝',EACCES:'宿主访问被系统拒绝',EHOSTUNREACH:'宿主无法到达 OSS 网络；请检查路由、VPN 和 macOS 本地网络权限',ENETUNREACH:'宿主无法到达 OSS 网络',ECONNREFUSED:'OSS 连接被拒绝',ECONNRESET:'OSS 连接被中断',ENOTFOUND:'OSS 地址解析失败',ETIMEDOUT:'OSS 请求超时'}
  code ||= status?`HTTP_${status}`:'UNKNOWN_TRANSPORT_ERROR'
  return Object.assign(new Error(`S3 元数据请求失败 [${code}]${hints[code]?`：${hints[code]}`:''}`),{status:status===403?403:502,code})
}

async function send(config, command, signal, client) {
  const own = !client
  client ??= createClient(config)
  try { return await client.send(command, { abortSignal: signal }) }
  catch (error) {
    const status = error.$metadata?.httpStatusCode
    if (status === 404) return null
    if (signal?.aborted) throw Object.assign(new Error('Request cancelled'), { status: 499 })
    // No raw transport error/headers/URLs in UI or agent output.
    throw metadataError(error)
  } finally { if (own) client.destroy() }
}

export async function listPrefix(config, bucket, prefix = '', options = {}) {
  const { key } = resolveTarget(config, bucket, prefix)
  const limit = pageLimit(options.limit, config)
  const recursive = options.recursive ?? false
  if (typeof recursive !== 'boolean') throw invalid('recursive must be boolean')
  let token
  if (options.cursor) {
    try {
      if (typeof options.cursor !== 'string' || options.cursor.length > 12000) throw Error()
      const cursor = JSON.parse(Buffer.from(options.cursor, 'base64url').toString())
      if (cursor.bucket !== bucket || cursor.prefix !== key || cursor.recursive !== recursive || typeof cursor.token !== 'string') throw Error()
      token = cursor.token
    } catch { throw invalid('cursor does not match this bucket/prefix/listing mode; restart listing') }
  }
  const page = await send(config, new ListObjectsV2Command({
    Bucket: bucket, Prefix: key, MaxKeys: limit,
    ...(recursive ? {} : { Delimiter: '/' }), ...(token ? { ContinuationToken: token } : {}),
  }), options.signal, options.client)
  if (!page) throw Object.assign(new Error('Bucket not found'), { status: 404 })
  const entries = [
    ...(page.CommonPrefixes ?? []).map(e => ({ path: e.Prefix, name: e.Prefix.slice(key.length).replace(/\/$/, ''), dir: true, size: 0 })),
    ...(page.Contents ?? []).map(e => ({ path: e.Key, name: e.Key.slice(key.length), dir: false, size: e.Size ?? 0, etag: e.ETag ?? null, modTime: e.LastModified?.toISOString() ?? null })),
  ]
  const nextCursor = page.IsTruncated && page.NextContinuationToken
    ? Buffer.from(JSON.stringify({ bucket, prefix: key, recursive, token: page.NextContinuationToken })).toString('base64url') : null
  if (page.IsTruncated && !nextCursor) throw new Error('S3 returned a truncated page without a continuation token')
  return { entries, total: entries.length, totalScope: 'page', truncated: Boolean(page.IsTruncated), nextCursor }
}

export async function statObject(config, bucket, key, options = {}) {
  const target = resolveTarget(config, bucket, key)
  if (!target.key) throw invalid('An exact object key is required')
  const object = await send(config, new HeadObjectCommand({ Bucket: bucket, Key: target.key }), options.signal, options.client)
  return object ? { path: target.key, name: target.key.split('/').pop(), size: object.ContentLength ?? 0,
    modTime: object.LastModified?.toISOString() ?? null, etag: object.ETag ?? null,
    contentType: object.ContentType ?? null, versionId: object.VersionId ?? null } : null
}

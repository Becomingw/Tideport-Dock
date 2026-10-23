/**
 * Model-facing osslab_* tools for the *user* side of the lab's S3 storage.
 *
 * Read-only tools run directly. Writes need `config.allowWrites` and an explicit
 * `execute: true`; deletions additionally need `config.allowDeletes`, the exact
 * `s3://bucket/key` confirmation, the current ETag and `writers_stopped: true`.
 * Nothing here can create buckets, change quotas or touch other identities.
 */
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { access, constants } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'

import { pageLimit } from './s3.js'
import { transferTool } from './transfer.js'
import { RequestsClient } from './requests.js'
import { inspectCredentials, resolveTarget } from './config.js'
import {
  copyFromRemote, copyToRemote, deleteObject, listBuckets, listPrefix, statObject, run,
} from './rclone.js'

const MAX_DIR_ENTRIES = 200

function fmtBytes(bytes) {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let value = Number(bytes) || 0
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

function summarizeEntries(result) {
  const dirs = result.entries.filter(entry => entry.dir)
  const files = result.entries.filter(entry => !entry.dir)
  const bytes = files.reduce((sum, entry) => sum + entry.size, 0)
  return { dirs: dirs.length, files: files.length, bytes }
}

function requireCredentials(config) {
  const status = inspectCredentials(config)
  if (!status.ok) {
    throw Object.assign(new Error(
      `personal credentials are not ready (${status.problem}); configure [${config.profile}] in ${status.path} with mode 600`,
    ), { status: 401 })
  }
  return status
}

async function rcloneVersion(config) {
  const text = await run(config, ['version'])
  return text.split('\n')[0].replace(/^rclone\s+/, '')
}

function renderLines(title, lines) {
  return [title, ...lines].join('\n')
}

export function createStorageTools(config, extraTools = []) {
  const tools = [...extraTools, transferTool(config)]

  tools.push({
    name: 'osslab_doctor',
    description: 'Check personal credentials, rclone bucket listing and the SDK directory-read path separately. Read-only, at most one entry in the requested bucket or first visible bucket.',
    parameters: { type: 'object', additionalProperties: false, properties: { bucket: {type:'string',description:'Optional approved bucket to probe; otherwise use the first visible bucket.'}, prefix:{type:'string',description:'Optional approved prefix for the one-entry probe.'} } },
    isConcurrencySafe: () => true,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => renderLines('OSS Lab client check', [
        `rclone: ${value.rclone}`,
        `credentials: ${value.credentials.ok ? 'ok' : value.credentials.problem}`,
        `endpoint: ${value.endpoint} (${value.endpointReachable ? 'bucket listing available' : 'bucket listing failed'})`,
        `SDK directory: ${value.metadata?.ok===true?'readable':value.metadata?.error||'not tested'}`,
      ]),
    },
    async execute(args={}, exec) {
      if(args.bucket) resolveTarget(config,args.bucket,args.prefix??'')
      let rclone = 'missing'
      let rcloneError = null
      try {
        rclone = await rcloneVersion(config)
      } catch (cause) {
        rcloneError = cause.message
      }
      const credentials = inspectCredentials(config)
      let endpointReachable = false, buckets=[]
      try {
        buckets=await listBuckets(config,{signal:exec?.signal})
        endpointReachable = true
      } catch {
        endpointReachable = false
      }
      const probeBucket=args.bucket || buckets[0]?.name
      let metadata={ok:null,error:null}
      if(probeBucket && credentials.ok) {
        try {await listPrefix(config,probeBucket,args.prefix??'',{limit:1,signal:exec?.signal});metadata={ok:true,error:null}}
        catch(error){metadata={ok:false,error:error.message}}
      }
      return { rclone, rcloneError, credentials, metadata, endpoint: config.endpoint, endpointReachable,
        profile: config.profile, allowWrites: config.allowWrites, allowDeletes: config.allowDeletes }
    },
  })

  tools.push({
    name: 'osslab_buckets',
    description: 'List the buckets your personal [osslab] credentials can see. Read-only; this does not prove write access to any bucket.',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    isConcurrencySafe: () => true,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => renderLines(`${value.buckets.length} buckets`, value.buckets.map(b => `- ${b.name}`)),
    },
    async execute(_args, exec) {
      requireCredentials(config)
      const buckets = await listBuckets(config, { signal: exec?.signal })
      return { buckets, count: buckets.length }
    },
  })

  tools.push({
    name: 'osslab_ls',
    description: 'List one prefix of an approved bucket (one level by default, bounded). Read-only.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['bucket'],
      properties: {
        bucket: { type: 'string', description: 'Bucket name you are approved to read.' },
        prefix: { type: 'string', description: 'Prefix without a leading slash; empty lists the bucket root.' },
        recursive: { type: 'boolean', default: false, description: 'List below the prefix; still bounded by limit.' },
        cursor: { type: 'string', description: 'Opaque nextCursor from the previous page for the same bucket/prefix/mode.' },
        limit: { type: 'integer', default: 100, description: `Page size (1..${Math.min(1000, config.maxListEntries)}).` },
      },
    },
    isConcurrencySafe: () => true,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => renderLines(
        `${value.entries.length} entries on this page${value.nextCursor ? ' (more available; pass nextCursor as cursor)' : ''}`,
        value.entries.slice(0, 50).map(e => `${e.dir ? 'dir ' : 'file'} ${e.size ? fmtBytes(e.size) : ''} ${e.path}`),
      ),
    },
    async execute(args, exec) {
      requireCredentials(config)
      const limit = pageLimit(args.limit ?? 100, config)
      const { bucket, key } = resolveTarget(config, args.bucket, args.prefix ?? '')
      const result = await listPrefix(config, bucket, key, { recursive: args.recursive ?? false, cursor: args.cursor, limit, signal: exec?.signal })
      return { bucket, prefix: key, ...result, ...summarizeEntries(result) }
    },
  })

  tools.push({
    name: 'osslab_stat',
    description: 'Stat a single object: size, mtime and opaque ETag (not necessarily a content checksum). Read-only; the ETag is what delete requires.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['bucket', 'key'],
      properties: {
        bucket: { type: 'string' },
        key: { type: 'string', description: 'Full object key inside the bucket.' },
      },
    },
    isConcurrencySafe: () => true,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => value.found
        ? renderLines(`s3://${value.bucket}/${value.key}`, [
          `size: ${fmtBytes(value.object.size)} (${value.object.size} bytes)`,
          `etag: ${value.object.etag ?? 'unavailable'}`,
          `modified: ${value.object.modTime ?? 'unknown'}`,
        ])
        : `not found: s3://${value.bucket}/${value.key}`,
    },
    async execute(args) {
      requireCredentials(config)
      const { bucket, key } = resolveTarget(config, args.bucket, args.key)
      const object = await statObject(config, bucket, key)
      return { bucket, key, found: Boolean(object), object }
    },
  })

  tools.push({
    name: 'osslab_get',
    description: 'Download one object to a new local file (never overwrites an existing local file). Read-only on the server.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['bucket', 'key'],
      properties: {
        bucket: { type: 'string' },
        key: { type: 'string' },
        dest_path: { type: 'string', description: 'Absolute or ~ path; defaults to the downloads dir + object name.' },
      },
    },
    isConcurrencySafe: () => false,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => `downloaded ${fmtBytes(value.bytes)} -> ${value.path}`,
    },
    async execute(args, exec) {
      requireCredentials(config)
      const { bucket, key } = resolveTarget(config, args.bucket, args.key)
      const object = await statObject(config, bucket, key)
      if (!object) throw Object.assign(new Error(`object not found: s3://${bucket}/${key}`), { status: 404 })
      const dest = args.dest_path
        ? resolve(String(args.dest_path).replace(/^~(?=$|\/)/, process.env.HOME))
        : join(config.downloadsDir, basename(key) || 'object')
      if (existsSync(dest)) throw new Error(`refusing to overwrite existing local file ${dest}; pick another dest_path`)
      mkdirSync(join(dest, '..'), { recursive: true })
      await copyFromRemote(config, bucket, key, dest, { signal: exec?.signal })
      return { bucket, key, path: dest, bytes: statSync(dest).size, etag: object.etag }
    },
  })

  const putSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['local_path', 'bucket', 'key'],
    properties: {
      local_path: { type: 'string', description: 'Local file to upload.' },
      bucket: { type: 'string' },
      key: { type: 'string', description: 'Target key; the object must not already exist.' },
      execute: { type: 'boolean', default: false, description: 'Actually upload; false only returns the plan.' },
    },
  }

  tools.push({
    name: 'osslab_put',
    description: 'Plan or execute an upload to a fixed key. Defaults to plan; --execute requires allowWrites and refuses to overwrite an existing object.',
    parameters: putSchema,
    isConcurrencySafe: () => false,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => value.executed
        ? `uploaded ${fmtBytes(value.bytes)} -> s3://${value.bucket}/${value.key} (etag ${value.etag ?? 'n/a'})`
        : renderLines('upload plan (not executed)', [
          `source: ${value.local_path} (${fmtBytes(value.bytes)})`,
          `target: s3://${value.bucket}/${value.key}`,
          `target exists: ${value.targetExists}`,
          value.allowed ? 'allowed: yes' : `allowed: no (${value.reason})`,
        ]),
    },
    async execute(args, exec) {
      requireCredentials(config)
      const { bucket, key } = resolveTarget(config, args.bucket, args.key)
      const localPath = resolve(String(args.local_path))
      if (!existsSync(localPath)) throw new Error(`local file not found: ${localPath}`)
      const stats = statSync(localPath)
      if (!stats.isFile()) throw new Error(`${localPath} is not a regular file`)
      const bytes = stats.size
      const target = await statObject(config, bucket, key)
      const plan = { local_path: localPath, bucket, key, bytes, targetExists: Boolean(target), executed: false }
      const limit = config.maxPutMiB * 1024 * 1024
      const allowed = config.allowWrites && !target && bytes <= limit
      const reason = !config.allowWrites ? 'writes disabled (config.allowWrites)'
        : target ? 'object already exists; pick a new key or use osslab_put_new'
          : bytes > limit ? `file exceeds config.maxPutMiB (${config.maxPutMiB})` : null
      if (!args.execute) return { ...plan, allowed, reason }
      if (!allowed) throw Object.assign(new Error(reason), { status: 403 })
      await copyToRemote(config, localPath, bucket, key, { immutable: true, signal: exec?.signal })
      const stored = await statObject(config, bucket, key)
      return { ...plan, executed: true, allowed: true, etag: stored?.etag ?? null, storedBytes: stored?.size ?? null }
    },
  })

  tools.push({
    name: 'osslab_put_new',
    description: 'Plan or execute an upload under a fresh unique key (checkpoints). Defaults to plan; --execute requires allowWrites.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['local_path', 'bucket'],
      properties: {
        local_path: { type: 'string' },
        bucket: { type: 'string' },
        prefix: { type: 'string', description: 'Directory prefix for the generated key.' },
        execute: { type: 'boolean', default: false },
      },
    },
    isConcurrencySafe: () => false,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => value.executed
        ? `uploaded ${fmtBytes(value.bytes)} -> s3://${value.bucket}/${value.key}`
        : `upload plan: ${value.local_path} -> s3://${value.bucket}/${value.key} (not executed)`,
    },
    async execute(args, exec) {
      requireCredentials(config)
      const { bucket, key: prefix } = resolveTarget(config, args.bucket, args.prefix ?? '')
      const localPath = resolve(String(args.local_path))
      if (!existsSync(localPath)) throw new Error(`local file not found: ${localPath}`)
      const bytes = statSync(localPath).size
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '')
      const suffix = randomBytes(3).toString('hex')
      const name = `${basename(localPath)}-${stamp}-${suffix}`
      const key = prefix ? `${prefix}/${name}` : name
      const plan = { local_path: localPath, bucket, key, bytes, executed: false }
      if (!args.execute) return plan
      if (!config.allowWrites) throw Object.assign(new Error('writes disabled (config.allowWrites)'), { status: 403 })
      if (bytes > config.maxPutMiB * 1024 * 1024) {
        throw Object.assign(new Error(`file exceeds config.maxPutMiB (${config.maxPutMiB})`), { status: 413 })
      }
      await copyToRemote(config, localPath, bucket, key, { immutable: true, signal: exec?.signal })
      const stored = await statObject(config, bucket, key)
      return { ...plan, executed: true, etag: stored?.etag ?? null, storedBytes: stored?.size ?? null }
    },
  })

  tools.push({
    name: 'osslab_delete',
    description: 'Preview or execute deletion of ONE exact object. Execute needs allowDeletes, the identical s3://bucket/key confirmation, the current ETag and writers_stopped=true. No recursive or bucket deletion.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['bucket', 'key'],
      properties: {
        bucket: { type: 'string' },
        key: { type: 'string' },
        execute: { type: 'boolean', default: false },
        confirm: { type: 'string', description: 'Must equal s3://bucket/key exactly.' },
        expect_etag: { type: 'string', description: 'ETag from a fresh preview; refuses if the object changed.' },
        writers_stopped: { type: 'boolean', default: false, description: 'Confirm no process is still writing this key.' },
      },
    },
    isConcurrencySafe: () => false,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => value.deleted
        ? `deleted s3://${value.bucket}/${value.key} (etag ${value.etag})`
        : renderLines(`delete preview: s3://${value.bucket}/${value.key}`, [
          `size: ${fmtBytes(value.size)}`,
          `etag: ${value.etag ?? 'unavailable'}`,
          `allowed: ${value.allowed ? 'yes' : `no (${value.reason})`}`,
          'not a lock: stop writers before deleting',
        ]),
    },
    async execute(args) {
      requireCredentials(config)
      const { bucket, key } = resolveTarget(config, args.bucket, args.key)
      const uri = `s3://${bucket}/${key}`
      const object = await statObject(config, bucket, key)
      if (!object) throw Object.assign(new Error(`object not found: ${uri}`), { status: 404 })
      const base = { bucket, key, size: object.size, etag: object.etag, deleted: false }
      const problems = []
      if (!config.allowDeletes) problems.push('deletes disabled (config.allowDeletes)')
      if (args.confirm !== uri) problems.push('confirm must equal the exact s3:// URI')
      if (!object.etag) problems.push('current ETag unavailable; deletion refused')
      if (!args.expect_etag) problems.push('expect_etag is required')
      else if (object.etag && args.expect_etag !== object.etag) problems.push('ETag differs from the current object')
      if (args.writers_stopped !== true) problems.push('writers_stopped must be true')
      if (!args.execute) return { ...base, allowed: problems.length === 0, reason: problems.join('; ') || null }
      if (problems.length) throw Object.assign(new Error(problems.join('; ')), { status: 403 })
      await deleteObject(config, bucket, key)
      return { ...base, deleted: true, allowed: true }
    },
  })

  tools.push({
    name: 'osslab_request',
    description: 'Prepare a bucket/access/quota request. Default: local text only. With explicit submit=true, send to the configured shared request service using the authenticated personal identity; requires kind, client_id and complete request fields. Approval is not provisioning. Reuse client_id for a retry. Never include secrets or patient data.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['jms_user', 'bucket'],
      properties: {
        jms_user: { type: 'string', description: 'JMS reference for the local draft only; never establishes server identity.' },
        submit: { type: 'boolean', description: 'Explicitly submit to the shared service; default false.' },
        kind: { type: 'string', enum: ['bucket','access','quota'] },
        client_id: { type: 'string', description: 'Stable unique ID for this submission and retries; do not reuse for different content.' },
        bucket: { type: 'string', description: 'Bucket name; lowercase, 3-63 characters.' },
        purpose: { type: 'string', description: 'Purpose of the requested storage access.' },
        quota_gib: { type: 'integer', description: 'Bucket quota target in GiB, not an account balance.' },
        array: { type: 'string', description: 'Approved placement label, or "no preference - delegate to admin".' },
        scope: { type: 'string', description: 'Empty string for the whole bucket, or the exact prefix/ (no s3:// URI).'  },
        permissions: { type: 'string', description: 'Read / List / Write.' },
        validity: { type: 'string', description: 'Expiry date or long-term.' },
        sharing: { type: 'string', description: 'Shared access and who owns deletion.' },
      },
    },
    isConcurrencySafe: () => true,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => value.text,
    },
    async execute(args) {
      if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(args.bucket)) {
        throw new TypeError('bucket must be lowercase, 3-63 characters, starting and ending alphanumeric')
      }
      if(args.submit===true) {
        const request=await new RequestsClient().call('submit',{kind:args.kind,bucket:args.bucket,purpose:args.purpose,quotaGiB:args.kind==='access'?null:args.quota_gib,placement:args.array||'',prefix:args.scope||'',permissions:(args.permissions||'').split(/[,/\s]+/).filter(Boolean),validUntil:args.validity,sharing:args.sharing||'',clientId:args.client_id})
        return {submitted:true,request,text:`申请已提交：${request.id}；状态：${request.status}。等待审批和实际交付。`}
      }
      const text = [
        `JMS 用户名：${args.jms_user}`,
        `桶名：${args.bucket}`,
        `用途：${args.purpose ?? '<数据存储用途>'}`,
        `目标容量：${args.quota_gib ?? '<整数 GiB，桶级配额目标值>'}`,
        `期望阵列：${args.array ?? '<指定放置偏好或明确委托管理员选择>'}`,
        `授权范围：${args.scope ?? '<整个桶或 prefix/>'}`,
        `权限：${args.permissions ?? '<Read / List / Write>'}`,
        `有效期：${args.validity ?? '<日期或长期>'}`,
        `共享与删除负责人：${args.sharing ?? '<说明>'}`,
      ].join('\n')
      return { text, submitted: false }
    },
  })

  for (const tool of tools) {
    tool.output.presentationMeta = (_args, value) => ({
      version: 1, tool: tool.name, bucket: value.bucket ?? null, key: value.key ?? value.prefix ?? null,
      executed: value.executed ?? (value.deleted ? true : undefined),
      preview: value.executed === false || value.deleted === false,
      count: value.entries?.length ?? value.count ?? null,
      truncated: value.truncated ?? false,
    })
  }
  return tools
}

export { MAX_DIR_ENTRIES }

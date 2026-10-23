/**
 * Owner-only panel routes (inherited browser auth via DSH connection.fetch).
 * They expose browsing + settings only: uploads, downloads and deletes stay in
 * the tool layer so the panel never becomes a second execution path.
 */
import { listBuckets, listPrefix, statObject } from './rclone.js'
import { pageLimit } from './s3.js'
import { createStorageTools as createTools } from './storage-tools.js'
import { resolveTarget } from './config.js'
import { adminStatus, AdminDrafts } from './admin.js'
import { RequestDrafts } from './request-drafts.js'
import { RequestsClient } from './requests.js'

const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export function registerRoutes(ctx, { store, requests = new RequestsClient() }) {
  const connection = ctx.get('connection')
  if (!connection?.fetch?.register) return
  const config = () => store.current
  const drafts = new AdminDrafts(store)
  const requestDrafts = new RequestDrafts(store)

  const handlers = {
    'requests/drafts': async () => requestDrafts.list(),
    'requests/drafts/create': async body => requestDrafts.create(body),
    ...Object.fromEntries(['session','list','submit','change'].map(action=>[`requests/${action}`,(body,signal)=>requests.call(action,body,signal)])),
    'admin/status': async () => adminStatus(store),
    'admin/drafts': async () => drafts.list(),
    'admin/drafts/create': async body => drafts.create(body),
    'settings/get': async () => store.snapshot(),
    'settings/save': async body => store.save(body),
    doctor: async (body,signal) => createTools(config()).find(t => t.name === 'osslab_doctor').execute(body,{signal}),
    async buckets(_body, signal) {
      const buckets = await listBuckets(config(), { signal })
      return { buckets, count: buckets.length }
    },
    async ls(body, signal) {
      const { bucket, key } = resolveTarget(config(), body.bucket, body.prefix ?? '')
      const limit = pageLimit(body.limit, config())
      const result = await listPrefix(config(), bucket, key, {
        recursive: body.recursive ?? false, cursor: body.cursor, limit, signal,
      })
      return { bucket, prefix: key, ...result }
    },
    async stat(body, signal) {
      const { bucket, key } = resolveTarget(config(), body.bucket, body.key)
      const object = await statObject(config(), bucket, key, { signal })
      return { bucket, key, found: Boolean(object), object }
    },
  }

  for (const [path, handle] of Object.entries(handlers)) {
    ctx.effect(() => connection.fetch.register({
      path: `/api/dsh-osslab/${path}`,
      methods: ['POST'],
      requestBody: 'buffered',
      async fetch(request) {
        try {
          const raw = await request.text()
          if (raw.length > 16384) return json({ error: 'Request too large' }, 413)
          let body
          try {
            body = JSON.parse(raw || '{}')
          } catch {
            return json({ error: 'Invalid JSON' }, 400)
          }
          if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Object required' }, 400)
          return json(await handle(body, request.signal))
        } catch (error) {
          return json({ error: error.message ?? String(error) }, error.status ?? (error instanceof TypeError ? 400 : 500))
        }
      },
    }))
  }
}

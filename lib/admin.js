/** Local preparation only. No cluster mutation or inferred administrator rights. */
import { readFileSync, mkdirSync, writeFileSync, renameSync, chmodSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

const bad = message => Object.assign(new Error(message), { status: 400 })
export function adminStatus(store) {
  const { settings, credentials } = store.snapshot()
  return {
    checkedAt: new Date().toISOString(), scope: 'personal',
    connection: { endpoint: settings.endpoint, profile: settings.profile, credentialsReady: credentials.ok },
    capabilities: { clusterRead: false, clusterWrite: false, localDrafts: true },
    management: { state: 'not_connected', identity: 'unverified' },
  }
}

export class AdminDrafts {
  constructor(store) { this.store = store; this.path = join(dirname(store.path), 'admin-drafts.json') }
  read() {
    try {
      const rows = JSON.parse(readFileSync(this.path, 'utf8'))
      if (!Array.isArray(rows)) throw new Error('invalid draft store')
      return rows
    } catch (error) { if (error.code === 'ENOENT') return []; throw error }
  }
  list() {
    const { endpoint, profile } = this.store.current
    return { drafts: this.read().filter(d => d.endpoint === endpoint && d.profile === profile).reverse() }
  }
  create(body) {
    const fields = ['bucket', 'owner', 'purpose', 'estimatedGiB', 'quotaGiB', 'placement', 'members']
    if (Object.keys(body).some(k => !fields.includes(k))) throw bad('Unknown draft field')
    const draft = {}
    for (const key of ['bucket', 'owner', 'purpose', 'placement', 'members']) {
      if (typeof body[key] !== 'string' || body[key].length > 1000 || /[\x00-\x1f]/.test(body[key])) throw bad(`Invalid ${key}`)
      draft[key] = body[key].trim()
    }
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(draft.bucket) || draft.bucket.includes('..') || /^\d+\.\d+\.\d+\.\d+$/.test(draft.bucket)) throw bad('Invalid bucket name')
    if (!draft.owner || !draft.purpose || !draft.placement) throw bad('Owner, purpose and placement are required')
    for (const key of ['estimatedGiB', 'quotaGiB']) {
      if (typeof body[key] !== 'number' || !Number.isFinite(body[key]) || body[key] <= 0 || body[key] > 1e9) throw bad(`Invalid ${key}`)
      draft[key] = body[key]
    }
    if (draft.estimatedGiB > draft.quotaGiB) throw bad('Estimated size exceeds quota')
    const rows = this.read()
    if (rows.length >= 200) throw Object.assign(new Error('Draft storage is full (200 drafts)'), { status: 409 })
    const { endpoint, profile } = this.store.current
    const result = { ...draft, id: randomUUID(), endpoint, profile, createdAt: new Date().toISOString(), state: 'draft', executed: false }
    const tmp = `${this.path}.${randomUUID()}.tmp`
    mkdirSync(dirname(this.path), { recursive: true })
    writeFileSync(tmp, JSON.stringify([...rows, result], null, 2), { mode: 0o600 })
    chmodSync(tmp, 0o600); renameSync(tmp, this.path)
    return result
  }
}

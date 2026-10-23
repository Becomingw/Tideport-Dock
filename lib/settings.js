/**
 * Visual settings for the OSS Lab plugin.
 *
 * Non-secret settings live in ~/.dsh/osslab/settings.json; the access key and
 * secret are written into the personal ~/.aws/credentials profile (0600) and
 * are never returned by the API — only "configured / mode / problem".
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import { expandHome, inspectCredentials, normalizeConfig } from './config.js'

export const EDITABLE = [
  'endpoint', 'region', 'profile', 'caBundle', 'insecureTLS',
  'allowedBuckets', 'allowWrites', 'allowDeletes', 'role', 'downloadsDir',
]

const ROLES = new Set(['user', 'admin'])

export function defaultSettingsPath() {
  return join(homedir(), '.dsh', 'osslab', 'settings.json')
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function atomicWrite(path, body, mode) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, body, { mode })
  chmodSync(tmp, mode)
  renameSync(tmp, path)
}

/** Replace or append one section of an ini-style credentials file. */
export function writeCredentialsProfile(path, profile, accessKey, secretKey) {
  const target = expandHome(path)
  let body = ''
  try {
    body = readFileSync(target, 'utf8')
  } catch {
    body = ''
  }
  const lines = body.split(/\r?\n/)
  const kept = []
  let inTarget = false
  for (const line of lines) {
    const header = /^\s*\[([^\]]+)\]\s*$/.exec(line)
    if (header) {
      inTarget = header[1].trim() === profile
      if (inTarget) continue
      kept.push(line)
      continue
    }
    if (inTarget) continue
    kept.push(line)
  }
  while (kept.length && kept[kept.length - 1].trim() === '') kept.pop()
  if (kept.length) kept.push('')
  kept.push(
    `[${profile}]`,
    `aws_access_key_id = ${accessKey}`,
    `aws_secret_access_key = ${secretKey}`,
    '',
  )
  atomicWrite(target, kept.join('\n'), 0o600)
}

export class SettingsStore {
  constructor(baseRaw = {}, path = defaultSettingsPath()) {
    this.path = path
    this.baseRaw = { ...baseRaw }
    this.stored = readJson(path)
    if (this.stored && typeof this.stored === 'object' && !Number.isInteger(this.stored.revision)) {
      this.stored.revision = 0
    }
    this.revision = this.stored?.revision ?? 0
    this.settings = this.normalizeStored(this.stored?.settings)
    this.config = normalizeConfig({ ...this.baseRaw, ...this.settings })
  }

  normalizeStored(raw = {}) {
    const settings = {}
    for (const key of EDITABLE) {
      if (raw && Object.prototype.hasOwnProperty.call(raw, key)) settings[key] = raw[key]
    }
    if (settings.role !== undefined && !ROLES.has(settings.role)) {
      throw Object.assign(new Error('role must be "user" or "admin"'), { status: 400 })
    }
    return settings
  }

  /** Effective config used by tools and routes; mutated in place on save. */
  get current() {
    return this.config
  }

  snapshot() {
    const credentials = inspectCredentials(this.config)
    return {
      revision: this.revision,
      settings: {
        endpoint: this.config.endpoint,
        region: this.config.region,
        profile: this.config.profile,
        caBundle: this.config.caBundle,
        insecureTLS: this.config.insecureTLS,
        allowedBuckets: this.config.allowedBuckets,
        allowWrites: this.config.allowWrites,
        allowDeletes: this.config.allowDeletes,
        downloadsDir: this.config.downloadsDir,
        role: this.settings.role ?? 'user',
      },
      credentials: {
        path: credentials.path,
        configured: credentials.profileFound,
        mode: credentials.mode,
        ok: credentials.ok,
        problem: credentials.problem,
      },
      paths: {
        settings: this.path,
        config: this.config.configPath,
        downloads: this.config.downloadsDir,
      },
    }
  }

  save(body = {}) {
    const allowed = new Set(['revision', 'settings', 'accessKey', 'secretKey'])
    for (const key of Object.keys(body)) {
      if (!allowed.has(key)) throw Object.assign(new Error(`unknown field ${key}`), { status: 400 })
    }
    if (body.revision !== this.revision) {
      throw Object.assign(new Error('settings changed elsewhere; reload before saving'), { status: 409 })
    }
    const patch = this.normalizeStored(body.settings ?? {})
    const settings = { ...this.settings, ...patch }
    // Validate everything before touching credentials, disk, or live config.
    let next
    try { next = normalizeConfig({ ...this.baseRaw, ...settings }) }
    catch (error) { throw Object.assign(error, { status: 400 }) }
    const hasKey = body.accessKey !== undefined || body.secretKey !== undefined
    if (hasKey) {
      const accessKey = String(body.accessKey ?? '').trim()
      const secretKey = String(body.secretKey ?? '').trim()
      if (!accessKey || !secretKey) {
        throw Object.assign(new Error('accessKey and secretKey must both be provided together'), { status: 400 })
      }
      if (!/^[A-Za-z0-9+/=_-]{8,256}$/.test(accessKey) || !/^[A-Za-z0-9+/=_-]{8,512}$/.test(secretKey)) {
        throw Object.assign(new Error('accessKey/secretKey contain unexpected characters'), { status: 400 })
      }
      writeCredentialsProfile(next.credentialsPath, next.profile, accessKey, secretKey)
    }
    const revision = this.revision + 1
    atomicWrite(this.path, JSON.stringify({ revision, settings }, null, 2), 0o600)
    this.settings = settings
    this.revision = revision
    Object.assign(this.config, next)
    return this.snapshot()
  }
}

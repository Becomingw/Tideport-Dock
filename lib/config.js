/**
 * Configuration and safety checks for the OSS Lab client.
 *
 * Secrets are never read into this module: only the *existence, mode and
 * profile names* of ~/.aws/credentials are inspected. The S3 layer receives
 * the profile name and lets rclone/AWS load the keys itself.
 */
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const DEFAULTS = {
  profile: 'osslab',
  endpoint: 'https://s3.example.invalid',
  region: 'us-east-1',
  caBundle: '',
  insecureTLS: false,
  credentialsPath: '~/.aws/credentials',
  configPath: '~/.config/osslab/config.json',
  downloadsDir: '~/Downloads/osslab',
  allowedBuckets: [],
  allowWrites: false,
  allowDeletes: false,
  maxListEntries: 1000,
  maxPutMiB: 512,
}

export function expandHome(value) {
  if (typeof value !== 'string' || !value) return value
  if (value === '~') return homedir()
  if (value.startsWith('~/')) return join(homedir(), value.slice(2))
  return value
}

function bool(value, fallback, label) {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new TypeError(`osslab: ${label} must be a boolean`)
  return value
}

function text(value, fallback, label) {
  if (value === undefined || value === '') return fallback
  if (typeof value !== 'string') throw new TypeError(`osslab: ${label} must be a string`)
  return value
}

function integer(value, fallback, label, min, max) {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new TypeError(`osslab: ${label} must be an integer in ${min}..${max}`)
  }
  return value
}

/** The non-secret config file may supply endpoint/region/ca_bundle. */
function readNonSecretConfig(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function normalizeConfig(raw = {}) {
  const config = { ...DEFAULTS, ...(raw ?? {}) }
  const configPath = expandHome(text(config.configPath, DEFAULTS.configPath, 'config.configPath'))
  const file = readNonSecretConfig(configPath)

  const endpoint = text(raw.endpoint ?? file.endpoint, DEFAULTS.endpoint, 'config.endpoint').trim()
  const profile = text(config.profile, DEFAULTS.profile, 'config.profile')
  const region = text(raw.region ?? file.region, DEFAULTS.region, 'config.region')

  let url
  try { url = new URL(endpoint) } catch {}
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new TypeError(`osslab: config.endpoint must be an http(s) URL, got ${JSON.stringify(endpoint)}`)
  }
  if (!/^[A-Za-z0-9._-]+$/.test(profile)) {
    throw new TypeError(`osslab: config.profile must look like an AWS profile name`)
  }
  const allowedBuckets = config.allowedBuckets ?? []
  if (!Array.isArray(allowedBuckets) || !allowedBuckets.every(b => typeof b === 'string' && b)) {
    throw new TypeError('osslab: config.allowedBuckets must be a list of bucket names')
  }

  return {
    profile,
    endpoint,
    region,
    caBundle: expandHome(text(raw.caBundle ?? file.ca_bundle, '', 'config.caBundle')),
    insecureTLS: bool(config.insecureTLS, DEFAULTS.insecureTLS, 'config.insecureTLS'),
    credentialsPath: expandHome(config.credentialsPath),
    configPath,
    configFile: file,
    downloadsDir: expandHome(config.downloadsDir),
    allowedBuckets: [...new Set(allowedBuckets)],
    allowWrites: bool(config.allowWrites, DEFAULTS.allowWrites, 'config.allowWrites'),
    allowDeletes: bool(config.allowDeletes, DEFAULTS.allowDeletes, 'config.allowDeletes'),
    maxListEntries: integer(config.maxListEntries, DEFAULTS.maxListEntries, 'config.maxListEntries', 1, 100000),
    maxPutMiB: integer(config.maxPutMiB, DEFAULTS.maxPutMiB, 'config.maxPutMiB', 1, 10240),
  }
}

/**
 * Report credential readiness without exposing key material.
 * `ok` means: file exists, mode is 0600, and the configured profile is present.
 */
export function inspectCredentials(config) {
  const path = expandHome(config.credentialsPath)
  let stats
  try {
    stats = statSync(path)
  } catch {
    return { path, exists: false, mode: null, profileFound: false, ok: false, problem: 'credentials file missing' }
  }
  const mode = (stats.mode & 0o777).toString(8).padStart(3, '0')
  let profileFound = false
  try {
    const body = readFileSync(path, 'utf8')
    profileFound = body.split(/\r?\n/).some(line => line.trim() === `[${config.profile}]`)
  } catch {
    return { path, exists: true, mode, profileFound: false, ok: false, problem: 'credentials file unreadable' }
  }
  const problems = []
  if (mode !== '600') problems.push(`permissions are ${mode}, expected 600`)
  if (!profileFound) problems.push(`profile [${config.profile}] not found`)
  return { path, exists: true, mode, profileFound, ok: problems.length === 0, problem: problems.join('; ') || null }
}

const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

/** Validate bucket/key and enforce the optional bucket allowlist. */
export function resolveTarget(config, bucket, key = '') {
  if (typeof bucket !== 'string' || !BUCKET.test(bucket)) {
    throw new TypeError(`invalid bucket name ${JSON.stringify(bucket)}`)
  }
  if (config.allowedBuckets.length && !config.allowedBuckets.includes(bucket)) {
    throw Object.assign(new Error(`bucket ${bucket} is not in config.allowedBuckets`), { status: 403 })
  }
  if (key === '' || key === undefined) return { bucket, key: '' }
  if (typeof key !== 'string') throw new TypeError('key must be a string')
  const clean = key.replace(/^\/+/, '')
  if (!clean || clean.split('/').some(part => part === '..')) {
    throw new TypeError(`invalid object key ${JSON.stringify(key)}`)
  }
  return { bucket, key: clean }
}

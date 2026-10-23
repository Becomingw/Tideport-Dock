/**
 * rclone bridge.
 *
 * The lab's S3 is reached with `:s3:` plus explicit flags and `--s3-env-auth`,
 * so no rclone config file and no copy of the AK/SK is needed: rclone reads the
 * personal `[osslab]` profile from ~/.aws/credentials itself.
 */
import { spawn } from 'node:child_process'

const ENV_PASSTHROUGH = ['HOME', 'USER', 'LOGNAME', 'PATH', 'LANG', 'LC_ALL', 'TMPDIR', 'SSH_AUTH_SOCK']
const STRIPPED = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_SECURITY_TOKEN']
const DEFAULT_TIMEOUT_MS = 5 * 60_000
const MAX_STDOUT = 16 << 20
const MAX_STDERR = 256 << 10

export class RcloneError extends Error {
  constructor(message, { code, stderr } = {}) {
    super(message)
    this.name = 'RcloneError'
    this.code = code
    this.stderr = stderr
  }
}

/** Environment for rclone: allowlist, minus ambient AWS keys that would override the profile. */
export function rcloneEnv(config, base = process.env) {
  const env = {}
  for (const key of ENV_PASSTHROUGH) if (base[key] !== undefined) env[key] = base[key]
  for (const key of STRIPPED) delete env[key]
  env.PATH = [env.PATH, '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
    .filter(Boolean).join(':')
  // Keep rclone from picking up an unrelated on-disk remote definition.
  env.RCLONE_CONFIG = '/dev/null'
  if (config.profile) env.AWS_PROFILE = config.profile
  if (config.credentialsPath) env.AWS_SHARED_CREDENTIALS_FILE = config.credentialsPath
  return env
}

/** Flags shared by every call. */
export function baseArgs(config) {
  const args = [
    '--s3-provider', 'Other',
    '--s3-endpoint', config.endpoint,
    '--s3-region', config.region,
    '--s3-force-path-style',
    '--s3-env-auth',
    '--s3-profile', config.profile,
    '--s3-chunk-size', '64M',
    '--s3-upload-cutoff', '64M',
  ]
  if (config.caBundle) args.push('--ca-cert', config.caBundle)
  else if (config.insecureTLS) args.push('--no-check-certificate')
  return args
}

/** `:s3:bucket/key` for rclone. */
export function s3Path(bucket, key = '') {
  return key ? `:s3:${bucket}/${key}` : `:s3:${bucket}`
}

/** Run rclone and return stdout. Exit code, stderr and timeout all become errors. */
export function run(config, args, { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('rclone', [...baseArgs(config), ...args], {
      env: rcloneEnv(config),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const out = []
    let outBytes = 0
    let errBytes = 0
    let err = ''
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    const onAbort = () => child.kill('SIGKILL')
    if (signal) {
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }
    child.stdout.on('data', chunk => {
      outBytes += chunk.length
      if (outBytes > MAX_STDOUT) {
        child.kill('SIGKILL')
        return
      }
      out.push(chunk)
    })
    child.stderr.on('data', chunk => {
      if (errBytes >= MAX_STDERR) return
      errBytes += chunk.length
      err += chunk.toString('utf8')
    })
    child.on('error', cause => {
      clearTimeout(timer)
      reject(new RcloneError(`failed to start rclone: ${cause.message}`))
    })
    child.on('close', code => {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
      if (code === 0) return resolve(Buffer.concat(out).toString('utf8'))
      const detail = err.trim().split('\n').slice(-4).join('\n')
      reject(new RcloneError(`rclone exited ${code}${detail ? `: ${detail}` : ''}`, { code, stderr: err }))
    })
  })
}

/** List buckets (first-level entries of the S3 service). */
export async function listBuckets(config, options = {}) {
  const text = await run(config, ['lsf', ':s3:', '--dirs-only', '--max-depth', '1'], options)
  return text.split('\n')
    .map(line => line.trim().replace(/\/$/, ''))
    .filter(Boolean)
    .filter(name => !config.allowedBuckets.length || config.allowedBuckets.includes(name))
    .map(name => ({ name }))
}

export { listPrefix, statObject } from './s3.js'

export async function copyToRemote(config, localPath, bucket, key, { immutable = false, signal } = {}) {
  const args = ['copyto', localPath, s3Path(bucket, key), '--s3-no-check-bucket']
  if (immutable) args.push('--immutable')
  await run(config, args, { signal, timeoutMs: 60 * 60_000 })
}

export async function copyFromRemote(config, bucket, key, localPath, { signal } = {}) {
  await run(config, ['copyto', s3Path(bucket, key), localPath], { signal, timeoutMs: 60 * 60_000 })
}

export async function deleteObject(config, bucket, key, options = {}) {
  await run(config, ['deletefile', s3Path(bucket, key)], options)
}

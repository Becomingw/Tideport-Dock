/** Agent-only server transfer bundle. Orca retains host policy and execution. */
import { readFileSync } from 'node:fs'
import { resolveTarget } from './config.js'
const read = name => readFileSync(new URL(`../transfers/${name}`, import.meta.url), 'utf8')
export function transferRecipe(config, args) {
  if (!['upload', 'download'].includes(args.direction)) throw new TypeError('direction must be upload or download')
  if (typeof args.local_path !== 'string' || !args.local_path.startsWith('/') || /[\0\r\n]/.test(args.local_path)) throw new TypeError('local_path must be absolute on the compute server')
  const { bucket, key } = resolveTarget(config, args.bucket, args.key)
  if (!key || key.endsWith('/')) throw new TypeError('one exact object key is required')
  if (args.sha256 !== undefined && !/^[a-f0-9]{64}$/.test(args.sha256)) throw new TypeError('sha256 must be lowercase hex')
  const settings = { endpoint:config.endpoint, region:config.region, profile:config.profile,
    ca_bundle:'', insecure_tls:config.caBundle ? false : config.insecureTLS, bucket,
    prefix:key.includes('/') ? key.slice(0,key.lastIndexOf('/')+1) : '',
    allow_writes:config.allowWrites, max_transfer_mib:Math.min(config.maxPutMiB,5120) }
  return { executed:false, bucket, key, direction:args.direction, execution_location:'compute server selected through an authorized remote tool',
    notes:['No credentials are copied; verify the server personal profile.',
      'Select a real configured SSH alias using the available remote runner (Orca when present). Read project files before patching.',
      'Read the remote plan, then use the authorized remote runner for execution and verify progress and exit code. With Orca use launch/status.',
      'Single files only. No overwrite, recursive sync or deletion. Uploads require allow_writes and --execute.',
      'Uploads use conditional creation and full read-back SHA256; server compatibility must be validated. Never downgrade conditional writes.',
      'No automatic resume. Failed downloads remove temporary files; ambiguous uploads require inspection.',
      ...(config.caBundle?['Set a verified remote ca_bundle path before execution.']:[])],
    commands:{plan:'python remote_transfer.py --config transfer-config.json --spec transfer-spec.json',
      execute:'python -u remote_transfer.py --config transfer-config.json --spec transfer-spec.json --execute'},
    files:[...['remote_transfer.py','s3_transport.py'].map(path=>({path,content:read(path)})),
      {path:'transfer-config.json',content:JSON.stringify(settings,null,2)},
      {path:'transfer-spec.json',content:JSON.stringify({direction:args.direction,local_path:args.local_path,object:{bucket,key},...(args.sha256?{sha256:args.sha256}:{})},null,2)},
      {path:'requirements-transfer.txt',content:'boto3>=1.36,<2\n'}] }
}
export function transferTool(config) {
 return {name:'osslab_transfer_recipe',description:'Prepare a server-side single-file OSS upload/download workflow with plan, atomic no-clobber downloads, conditional uploads, SHA256 read-back verification and progress. Local paths refer to the compute server, not DSH. Pure recipe; no remote execution or credentials. Agent must inspect the remote plan and use an authorized remote runner, preferably Orca launch/status.',
 parameters:{type:'object',additionalProperties:false,required:['direction','bucket','key','local_path'],properties:{direction:{type:'string',enum:['upload','download']},bucket:{type:'string'},key:{type:'string'},local_path:{type:'string'},sha256:{type:'string',description:'Optional independently known content SHA256; lowercase hex.'}}},
 isConcurrencySafe:()=>true,output:{schema:{type:'object'},render:(_args,value)=>JSON.stringify(value,null,2)},execute:async args=>transferRecipe(config,args)}
}

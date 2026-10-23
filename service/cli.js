#!/usr/bin/env node
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { writeFileSync, unlinkSync } from 'node:fs'
import { requestServiceURL } from '../lib/requests.js'
import { Workflow } from './workflow.js'
import { requestServer } from './server.js'
const [action,...args]=process.argv.slice(2)
const options={};for(let i=0;i<args.length;i+=2){if(!args[i]?.startsWith('--')||!args[i+1])throw new Error('Expected --option value');options[args[i].slice(2)]=args[i+1]}
if(!options.db) throw new Error('--db is required')
if(action==='serve') {
  const {server}=requestServer({path:resolve(options.db)})
  const port=Number(options.port ?? 8767),host=options.host ?? '127.0.0.1'
  if(!Number.isInteger(port)||port<1||port>65535) throw new Error('Invalid port')
  server.listen(port,host,()=>process.stdout.write(`Request service listening on ${host}:${port}\n`))
  const stop=()=>server.close(()=>process.exit(0));process.on('SIGTERM',stop);process.on('SIGINT',stop)
} else if(action==='enroll') {
  if(!options.id||!options.role||!options.out||!options.url) throw new Error('--id, --role, --url and --out are required')
  if(!['user','admin'].includes(options.role) || options.id.length>100 || /[\x00-\x1f]/.test(options.id)) throw new Error('Invalid identity or role')
  const url=requestServiceURL(options.url)
  const token=randomBytes(32).toString('base64url'),db=new Workflow(resolve(options.db))
  // Refuse to overwrite an existing credential package; never print its token.
  writeFileSync(resolve(options.out),JSON.stringify({url,token},null,2),{mode:0o600,flag:'wx'})
  try{db.enroll(options.id,options.role,token)}catch(error){unlinkSync(resolve(options.out));throw error}finally{db.close()}
  process.stdout.write('Credential package saved; deliver privately to the named user.\n')
} else throw new Error('Use serve or enroll')

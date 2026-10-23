import { createServer } from 'node:http'
import { Workflow, fail } from './workflow.js'
export function requestServer({ path, workflow = new Workflow(path) }) {
  const server=createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store')
    try {
      if(req.method!=='POST') fail('Method not allowed',405)
      const token=/^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1]
      const user=workflow.authenticate(token)
      const chunks=[]; let size=0
      for await(const chunk of req) { size+=chunk.length;if(size>16384) fail('Request too large',413);chunks.push(chunk) }
      let data
      try{data=JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')}catch{fail('Invalid JSON')}
      if(!data||typeof data!=='object'||Array.isArray(data)) fail('Object required')
      let result
      switch(req.url){
        case '/v1/session': result={user,serviceVersion:1,executionMode:'admin-managed'};break
        case '/v1/requests/list':result=workflow.list(user,data);break
        case '/v1/requests/submit':result=workflow.submit(user,data);break
        case '/v1/requests/change':result=workflow.transition(user,data);break
        default:fail('Not found',404)
      }
      res.end(JSON.stringify(result))
    }catch(error){res.statusCode=error.status ?? 500;res.end(JSON.stringify({error:error.status ? error.message : 'Request service failed'}))}
  })
  server.requestTimeout=15000;server.headersTimeout=10000
  return {server,workflow}
}

import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {normalizeConfig} from '../lib/config.js'
import {createStorageTools} from '../lib/storage-tools.js'
import {transferRecipe} from '../lib/transfer.js'
const cfg=normalizeConfig({endpoint:'https://s3.example.invalid',configPath:'/nonexistent',allowedBuckets:['test-bucket']})
test('storage permissions are closed by default and bucket scope is enforced',()=>{assert.equal(cfg.allowWrites,false);assert.equal(cfg.allowDeletes,false);assert.equal(createStorageTools(cfg).length,10);assert.throws(()=>transferRecipe(cfg,{direction:'download',bucket:'other-bucket',key:'a',local_path:'/tmp/a'}),/not in/)})
test('transfer bundle is complete and does not execute',()=>{const r=transferRecipe(cfg,{direction:'download',bucket:'test-bucket',key:'a',local_path:'/tmp/a'});assert.equal(r.executed,false);assert.equal(r.files.length,5);assert.ok(r.files.some(f=>f.path==='s3_transport.py'))})
test('server transfer assets are self-contained',()=>{assert.deepEqual(readdirSync(new URL('../transfers/',import.meta.url)).filter(x=>x.endsWith('.py')).sort(),['remote_transfer.py','s3_transport.py'])})
test('DSH entry and client identity match this package',async()=>{const m=await import('../index.js');assert.equal(m.name,'osslab');assert.equal(typeof m.apply,'function');assert.ok(readFileSync(new URL('../client.js',import.meta.url),'utf8').includes("id: 'dsh-tideport-dock'"))})

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pin=JSON.parse(fs.readFileSync(path.join(root,'host/upstream.json'),'utf8'));
const host=path.join(root,'.cache/hosts/clawd-on-desk');
function run(command,args,cwd=root){const result=spawnSync(command,args,{cwd,stdio:'inherit',shell:false});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1)}
if(!fs.existsSync(path.join(host,'.git'))){
  fs.mkdirSync(path.dirname(host),{recursive:true});
  run('git',['clone','--no-checkout',pin.repository,host]);
  run('git',['checkout','--detach',pin.commit],host);
}
run(process.execPath,[path.join(root,'scripts/audit_host.mjs')]);
// Windows .cmd launch needs cmd.exe; all arguments here are fixed literals.
if(process.platform==='win32')run('cmd.exe',['/d','/s','/c','npm ci --ignore-scripts --no-audit --no-fund'],host);
else run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],host);
run(process.execPath,['node_modules/electron/install.js'],host);
run(process.execPath,['scripts/verify-electron-install.js'],host);
console.log('Clawd development host ready. npm start imports the themes and starts the host.');

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const installationFile=path.join(root,'build/local-install.json');
const installation=fs.existsSync(installationFile)?JSON.parse(fs.readFileSync(installationFile,'utf8')):null;
const host=installation&&!process.argv.includes('--development')?installation.host:path.join(root,'.cache/hosts/clawd-on-desk');
execFileSync(process.execPath,[path.join(root,'scripts/audit_host.mjs'),host],{stdio:'inherit'});
const source=path.join(root,'dist/mysekai-clawd/themes');
const userData=process.platform==='win32'?path.join(process.env.APPDATA,'clawd-on-desk'):
  process.platform==='darwin'?path.join(os.homedir(),'Library/Application Support/clawd-on-desk'):
    path.join(process.env.XDG_CONFIG_HOME||path.join(os.homedir(),'.config'),'clawd-on-desk');
fs.mkdirSync(path.join(userData,'themes'),{recursive:true});
const upgrade=process.argv.includes('--upgrade');
const backup=path.join(userData,'theme-backups',new Date().toISOString().replace(/[:.]/g,'-'));
if(upgrade){
  const runtimePath=path.join(os.homedir(),'.clawd/runtime.json');
  if(fs.existsSync(runtimePath)){
    const runtime=JSON.parse(fs.readFileSync(runtimePath,'utf8'));
    try{process.kill(runtime.ownerPid,0);throw Error('Close Clawd before upgrading themes.')}catch(e){if(e.code!=='ESRCH')throw e}
  }
}
for(const id of fs.readdirSync(source)){
  if(!/^pjsk-[a-z-]+$/.test(id))throw Error('Unexpected theme directory');
  const target=path.join(userData,'themes',id);
  if(fs.existsSync(target)){
    if(!upgrade){console.log(`Keeping existing theme: ${id}`);continue}
    if(fs.lstatSync(target).isSymbolicLink())throw Error('Refusing to replace a linked theme: '+id);
    // Explicit upgrade keeps a complete recoverable copy, including custom edits.
    fs.mkdirSync(backup,{recursive:true});fs.renameSync(target,path.join(backup,id));
  }
  fs.cpSync(path.join(source,id),target,{recursive:true,errorOnExist:true,force:false});
}
const prefsPath=path.join(userData,'clawd-prefs.json');
if(!fs.existsSync(prefsPath)){
  // Bootstrap only before the host exists. Runtime preference writes belong to
  // the upstream settings controller; never overwrite an existing snapshot.
  const prefs=createRequire(import.meta.url)(path.join(host,'src/prefs.js'));
  const initial=prefs.getDefaults();initial.lang='zh';initial.theme='pjsk-mafuyu';
  initial.permissionAutomationMode='off';initial.autoApproveAllPermissions=false;
  initial.agents.codex.permissionMode='native';
  initial.agents['deepseek-harness'].integrationInstalled=true;
  initial.agents['deepseek-harness'].enabled=true;
  prefs.save(prefsPath,initial);
}
console.log('MYSEKAI: 31 forms. Settings → Themes changes character; automatic approvals are off on first launch.');
console.log('Program: '+host+'\nPhysical data: '+fs.realpathSync(userData));
if(upgrade)console.log('Previous themes saved to: '+backup);
if(process.argv.includes('--install-only'))process.exit(0);
const child=spawn(process.execPath,[path.join(host,'launch.js')],{cwd:host,stdio:'inherit',env:process.env});
child.on('exit',code=>process.exit(code??1));child.on('error',error=>{console.error(error);process.exit(1)});

import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require=createRequire(import.meta.url),host=path.join(root,'.cache/hosts/clawd-on-desk');
const schema=require(path.join(host,'src/theme-schema.js'));
const themes=path.join(root,'dist/mysekai-clawd/themes');
const pack=JSON.parse(fs.readFileSync(path.join(root,'dist/mysekai-clawd/pack.json'),'utf8'));
const ids=fs.readdirSync(themes);
if(ids.length!==pack.forms||ids.length!==31)throw Error('Expected 31 theme forms');
const sources=ids.map(id=>JSON.parse(fs.readFileSync(path.join(themes,id,'source.json'),'utf8')));
if(new Set(sources.map(c=>c.characterId)).size!==26)throw Error('Expected 26 identities');
if(new Set(sources.map(c=>c.unitId)).size!==31)throw Error('Expected 31 JP forms');
if(pack.characters.some(c=>!ids.includes(c.id)))throw Error('Pack references a missing theme');
const results=[];
for(const id of ids){
  const dir=path.join(themes,id),raw=JSON.parse(fs.readFileSync(path.join(dir,'theme.json'),'utf8'));
  const errors=schema.validateTheme(raw);if(errors.length)throw Error(id+': '+errors.join('; '));
  for(const file of schema.collectRequiredAssetFiles(raw))if(!fs.statSync(path.join(dir,'assets',file)).isFile())throw Error(id+': missing '+file);
  const run=spawnSync(process.execPath,[path.join(host,'scripts/validate-theme.js'),dir],{encoding:'utf8'});
  if(run.status!==0)throw Error(run.stdout+run.stderr);
  results.push({id,valid:true,previewWarningOnly:/unreferenced.*portrait.png/.test(run.stdout)});
}
fs.mkdirSync(path.join(root,'build/validation'),{recursive:true});
fs.writeFileSync(path.join(root,'build/validation/clawd-themes.json'),JSON.stringify(results,null,2)+'\n');
console.log(`PASS: all ${ids.length} themes validated by Clawd. The upstream CLI labels the declared preview portrait as unreferenced.`);
execFileSync(process.execPath,[path.join(root,'scripts/audit_host.mjs')],{stdio:'inherit'});

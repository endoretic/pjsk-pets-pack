import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require=createRequire(import.meta.url);
const host=path.join(root,'.cache/hosts/clawd-on-desk');
const schema=require(path.join(host,'src/theme-schema.js'));
const createThemeContext=require(path.join(host,'src/theme-context.js'));
const dir=path.join(root,'build/web/host-config');fs.mkdirSync(dir,{recursive:true});
for(const id of fs.readdirSync(path.join(root,'dist/mysekai-clawd/themes'))){
  const themeDir=path.join(root,'dist/mysekai-clawd/themes',id);
  const raw=JSON.parse(fs.readFileSync(path.join(themeDir,'theme.json'),'utf8'));
  const theme=schema.mergeDefaults(raw,id,false);
  theme._themeDir=themeDir;
  const cfg=createThemeContext(theme).getRendererConfig();
  cfg.assetsPath=cfg.sourceAssetsPath=`/clawd-themes/${id}/assets`;
  fs.writeFileSync(path.join(dir,id+'.js'),'window.themeConfig = '+JSON.stringify(cfg)+';\n');
}
console.log('Prepared actual Clawd renderer browser preview');
